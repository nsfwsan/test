const BASE_URL = "https://e621.net/posts.json"

let e621Slides = []
let e621CursorId = undefined  // undefined = no cursor yet; null = results exhausted
let e621IsLoading = false
let e621Tags = ""
let lastFetchTime = 0
let e621Username = ""
let e621ApiKey = ""

// form element refs — set by initE621()
let e621TagsInput, e621SortSelect
let e621RatingSafe, e621RatingQuest, e621RatingExplicit
let e621UsernameInput, e621ApiKeyInput

export async function startE621() {
    const userTags = e621TagsInput.value.trim()
    if (userTags === "") return false

    const sort = e621SortSelect.value
    const tagParts = [userTags, "order:" + sort]

    const allRatings = [e621RatingSafe.checked, e621RatingQuest.checked, e621RatingExplicit.checked]
    if (!allRatings.every(Boolean)) {
        const ratingLetters = []
        if (e621RatingSafe.checked) ratingLetters.push("s")
        if (e621RatingQuest.checked) ratingLetters.push("q")
        if (e621RatingExplicit.checked) ratingLetters.push("e")
        if (ratingLetters.length > 0) tagParts.push("rating:" + ratingLetters.join(","))
    }

    e621Tags = tagParts.join(" ")
    e621Username = e621UsernameInput.value.trim()
    e621ApiKey = e621ApiKeyInput.value.trim()

    if (e621Username && e621ApiKey) {
        localStorage.setItem("e621Credentials", JSON.stringify({ username: e621Username, apiKey: e621ApiKey }))
    }

    e621Slides = []
    e621CursorId = undefined
    e621IsLoading = false
    lastFetchTime = 0

    await loadNextPage()
    return e621Slides.length > 0
}

async function loadNextPage() {
    if (e621CursorId === null || e621IsLoading) return
    e621IsLoading = true

    const elapsed = Date.now() - lastFetchTime
    if (elapsed < 1000) await new Promise(r => setTimeout(r, 1000 - elapsed))

    let url = BASE_URL + "?limit=320&tags=" + encodeURIComponent(e621Tags)
    if (e621CursorId !== undefined) url += "&page=b" + e621CursorId

    // Browsers always send their own User-Agent — the custom UA rule targets
    // automated scripts, not browsers making direct requests, so this is fine.
    const options = {}
    if (e621Username && e621ApiKey) {
        options.headers = { "Authorization": "Basic " + btoa(e621Username + ":" + e621ApiKey) }
    }

    try {
        lastFetchTime = Date.now()
        const response = await fetch(url, options)
        const json = await response.json()
        const posts = json.posts

        if (!posts || posts.length === 0) {
            e621CursorId = null
            e621IsLoading = false
            return
        }

        e621CursorId = posts[posts.length - 1].id

        for (const post of posts) {
            if (!post.file.url || post.file.ext === "swf") continue
            const { url: fileUrl, ext, width, height } = post.file
            if (["jpg", "png", "gif", "webp"].includes(ext)) {
                e621Slides.push({ type: "short", format: "image", url: fileUrl, width, height })
            } else if (["mp4", "webm"].includes(ext)) {
                e621Slides.push({ type: "short", format: "video", url: fileUrl, width, height })
            }
        }
    } catch (e) {
        console.error("e621 fetch error:", e)
    }

    e621IsLoading = false
}

function scaleWidth(fitHeight, height, width) {
    return width * (fitHeight / height)
}

export async function nextE621Slides(remainingWidth, height, isEmpty) {
    if (e621Slides.length === 0) return []
    if (e621Slides.length < 10) loadNextPage()

    const toAdd = []
    let newRemainingWidth = remainingWidth

    while (newRemainingWidth > 50) {
        if (e621Slides.length === 0) break

        let picked = false
        for (let i = 0; i < e621Slides.length && i < 10; i++) {
            const scaledWidth = scaleWidth(height, e621Slides[i].height, e621Slides[i].width)
            if (scaledWidth < newRemainingWidth) {
                const slide = e621Slides.splice(i, 1)[0]
                slide.scaledWidth = scaledWidth
                toAdd.push(slide)
                newRemainingWidth -= scaledWidth
                picked = true
                break
            }
        }

        if (!picked) {
            if (isEmpty) {
                const scaledHeight = scaleWidth(newRemainingWidth, e621Slides[0].width, e621Slides[0].height)
                const scaledWidth = scaleWidth(scaledHeight, e621Slides[0].height, e621Slides[0].width)
                const slide = e621Slides.splice(0, 1)[0]
                slide.scaledWidth = scaledWidth
                toAdd.push(slide)
                newRemainingWidth = 0
            }
            break
        }
    }

    return toAdd
}

export function initE621() {
    e621TagsInput = document.getElementById("e621Tags")
    e621SortSelect = document.getElementById("e621Sort")
    e621RatingSafe = document.getElementById("e621RatingSafe")
    e621RatingQuest = document.getElementById("e621RatingQuest")
    e621RatingExplicit = document.getElementById("e621RatingExplicit")
    e621UsernameInput = document.getElementById("e621Username")
    e621ApiKeyInput = document.getElementById("e621ApiKey")

    const saved = localStorage.getItem("e621Credentials")
    if (saved) {
        const { username, apiKey } = JSON.parse(saved)
        e621UsernameInput.value = username || ""
        e621ApiKeyInput.value = apiKey || ""
    }

    document.getElementById("e621ClearLogin").onclick = () => {
        localStorage.removeItem("e621Credentials")
        e621UsernameInput.value = ""
        e621ApiKeyInput.value = ""
    }

    e621TagsInput.onkeydown = (e) => {
        if (e.code === "Enter") document.getElementById("e621Submit").click()
    }
}
