/**
 * Browser-based berry counter using canvas pixel analysis.
 * Counts dark objects on a light (white tray) background within user-drawn zones.
 * No external libraries — runs entirely in the browser.
 *
 * Works on any dark-on-light objects for testing (coins, marbles, etc.)
 */

/**
 * Process an image with user-defined zones and count dark blobs in each.
 * @param {string} imageDataUrl - base64 data URL from camera capture
 * @param {Array<{key, x, y, w, h}>} zones - zones as fractions 0-1 of image dimensions
 * @returns {Promise<{counts: Object, debug: Object}>}
 */
export async function countBerriesInZones(imageDataUrl, zones) {
  const img = await loadImage(imageDataUrl)

  // Draw to offscreen canvas
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  // Scale down for faster processing — 800px wide is plenty
  const scale = Math.min(1, 800 / img.width)
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const { width, height, data } = imageData

  // Step 1: Convert to grayscale
  const gray = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
  }

  // Step 2: Adaptive threshold — sample background from edges of each zone
  // and also the overall image edges
  const allSamples = []
  // Sample image edges
  for (let x = 0; x < width; x++) {
    allSamples.push(gray[x])
    allSamples.push(gray[(height - 1) * width + x])
  }
  for (let y = 0; y < height; y++) {
    allSamples.push(gray[y * width])
    allSamples.push(gray[y * width + width - 1])
  }
  allSamples.sort((a, b) => a - b)
  const bgBrightness = allSamples[Math.floor(allSamples.length * 0.7)]
  const threshold = Math.max(60, bgBrightness * 0.65) // more permissive — catches lighter objects

  // Step 3: Create binary mask (1 = dark object, 0 = background)
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) {
    mask[i] = gray[i] < threshold ? 1 : 0
  }

  // Step 4: Connected component labeling (flood fill)
  const labels = new Int32Array(width * height)
  let labelCount = 0
  const labelSizes = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (mask[idx] === 1 && labels[idx] === 0) {
        labelCount++
        const size = floodFill(mask, labels, width, height, x, y, labelCount)
        labelSizes.push({ label: labelCount, size })
      }
    }
  }

  // Step 5: Filter by size
  // Loosened filters — blueberries vary a lot in apparent size depending on distance
  const minSize = Math.round(width * height * 0.00005) // ~0.005% of image — catches small objects
  const maxSize = Math.round(width * height * 0.05)    // ~5% of image — allows larger objects

  // Calculate centroid for each blob
  const centroidX = new Float32Array(labelCount + 1)
  const centroidY = new Float32Array(labelCount + 1)
  const centroidCount = new Int32Array(labelCount + 1)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const l = labels[y * width + x]
      if (l > 0) {
        centroidX[l] += x
        centroidY[l] += y
        centroidCount[l]++
      }
    }
  }

  const blobs = []
  for (const ls of labelSizes) {
    if (ls.size >= minSize && ls.size <= maxSize) {
      const l = ls.label
      blobs.push({
        size: ls.size,
        cx: centroidX[l] / centroidCount[l],
        cy: centroidY[l] / centroidCount[l],
      })
    }
  }

  // Step 6: Assign blobs to user-drawn zones based on centroid position
  const counts = {}
  for (const zone of zones) {
    counts[zone.key] = 0
  }

  for (const blob of blobs) {
    const rx = blob.cx / width
    const ry = blob.cy / height

    for (const zone of zones) {
      if (rx >= zone.x && rx <= zone.x + zone.w &&
          ry >= zone.y && ry <= zone.y + zone.h) {
        counts[zone.key]++
        break
      }
    }
  }

  return {
    counts,
    debug: {
      bgBrightness: Math.round(bgBrightness),
      threshold: Math.round(threshold),
      blobsBeforeFilter: labelSizes.length,
      blobsAfterFilter: blobs.length,
      imageSize: `${width}x${height}`,
      minBlobSize: minSize,
      maxBlobSize: maxSize,
    }
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function floodFill(mask, labels, width, height, startX, startY, label) {
  const stack = [[startX, startY]]
  let size = 0

  while (stack.length > 0) {
    const [x, y] = stack.pop()
    const idx = y * width + x

    if (x < 0 || x >= width || y < 0 || y >= height) continue
    if (mask[idx] !== 1 || labels[idx] !== 0) continue

    labels[idx] = label
    size++

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }

  return size
}
