/**
 * If the image is portrait (taller than wide), rotate it 90° clockwise to landscape.
 * Returns a Promise that resolves to the (possibly rotated) data URL.
 */
export function ensureLandscape(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      if (img.height > img.width) {
        const canvas = document.createElement('canvas')
        canvas.width = img.height
        canvas.height = img.width
        const ctx = canvas.getContext('2d')
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate(-Math.PI / 2)
        ctx.drawImage(img, -img.width / 2, -img.height / 2)
        resolve(canvas.toDataURL('image/jpeg', 0.92))
      } else {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}
