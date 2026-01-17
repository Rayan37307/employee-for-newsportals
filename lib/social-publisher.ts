import axios from 'axios'

interface PostOptions {
    pageId: string
    accessToken: string
    caption: string
    imageBuffer: Buffer
}

export async function publishToFacebook({ pageId, accessToken, caption, imageBuffer }: PostOptions) {
    // Determine mime type (png)
    const blob = new Blob([imageBuffer as unknown as BlobPart], { type: 'image/png' })

    // We need to send FormData
    const formData = new FormData()
    formData.append('message', caption)
    formData.append('access_token', accessToken)
    formData.append('source', blob, 'card.png')
    formData.append('published', 'true')

    // Note: Node environment FormData handling with axios usually requires 'form-data' package or similar logic if new FormData() isn't fully supported for file uploads the same way as browser.
    // In Node 18+ (Next.js is on 16.1.3? Node version likely > 18), native FormData exists.
    // However, attaching a Buffer to generic FormData in Node can be tricky.
    // Let's use 'form-data' package logic implicitly if possible or construct properly.

    // Actually, sending binary via axios in Node is easier with 'form-data' package.
    // But let's try standard fetch first to avoid extra deps if possible.

    // Let's use the native 'fetch' which supports FormData with Blobs in modern Node.

    const url = `https://graph.facebook.com/v19.0/${pageId}/photos`

    const response = await fetch(url, {
        method: 'POST',
        body: formData
    })

    const data = await response.json()

    if (!response.ok) {
        throw new Error(`Facebook API Error: ${data.error?.message || 'Unknown error'}`)
    }

    return {
        id: data.id,
        postId: data.post_id
    }
}
