import * as url from 'url'

import path from 'path'
import ParseMSCH from './ParseMSCH.js'
import fs from 'fs/promises'
import CustomBuffer from './CustomBuffer.js'
import ParseLogicConfig from './ParseLogicConfig.js'
import GenerateMSCH from './GenerateMSCH.js'
import { createCanvas, loadImage, ImageData, Image } from 'canvas'
import Stile from './Data/Stile.js'
import Point2 from './Data/Point2.js'
import Byte from './Data/Number/Byte.js'
import Int from './Data/Number/Int.js'
import Content from './Data/Content.js'
import Short from './Data/Number/Short.js'
import { SorterID, SorterIDToColor } from './Data/Vars.js'
import Schematic from './Data/Schematic.js'
import NearestColor, { RGBColor } from './Utils/NearestColor.js'
import * as iq from 'image-q'
import Dither from 'canvas-dither'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

// const deflatedData = await fs.readFile(
// 	path.join(__dirname, '../data/metaglass_core.msch')
// )

// const base64 =
// 	'bXNjaAF4nEXJSwqAMAwE0NHWVnDj/cSFnywK/mhyf7QOaAKZMA8tvIM/pl0QTVTNDN0quuR0WToPAGGbZtkU9TBWCHpmk/zUPf6py6mefcN9VYn3cTRH8zRPa2gNLdACLdJisRubug+/'

// const deflatedData = Buffer.from(base64, 'base64')

// const schematic = await ParseMSCH(CustomBuffer.fromBuffer(deflatedData))

// console.log(schematic.tiles)

const art = await loadImage(path.join(__dirname, '../data/roach.png'))

const width = 100
const height = 100

const canvas = createCanvas(width, height)
const ctx = canvas.getContext('2d')

ctx.drawImage(art, 0, 0, width, height)

const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)

const pointContainer = iq.utils.PointContainer.fromUint8Array(
	imgData.data,
	width,
	height
)

const palette = await iq.buildPalette([pointContainer], {
	colors: Object.keys(SorterID).length,
})

const outPointContainer = await iq.applyPalette(pointContainer, palette, {
	colorDistanceFormula: 'euclidean', // optional
	imageQuantization: 'floyd-steinberg', // optional
})

const imageData = outPointContainer.toUint8Array()

ctx.putImageData(
	new ImageData(new Uint8ClampedArray(imageData), width, height),
	0,
	0
)

const ditheredImage: ImageData = Dither.atkinson(
	new ImageData(ctx.getImageData(0, 0, width, height).data, width, height)
)

const ditheredData = ditheredImage.data

const newDitheredDataArray = new Uint8ClampedArray(ditheredData.length)

for (let i = 0; i < ditheredData.length; i += 4) {
	const red = ditheredData[i]
	const green = ditheredData[i + 1]
	const blue = ditheredData[i + 2]
	const alpha = ditheredData[i + 3]

	newDitheredDataArray[i] = red
	newDitheredDataArray[i + 1] = green
	newDitheredDataArray[i + 2] = blue
	newDitheredDataArray[i + 3] = alpha - 255 * 0.95
}

const newDitheredData = new ImageData(newDitheredDataArray, width, height)

const newDitherCanvas = createCanvas(width, height)
const newDitherCtx = newDitherCanvas.getContext('2d')

newDitherCtx.putImageData(newDitheredData, 0, 0)

ctx.drawImage(newDitherCanvas, 0, 0)

const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data

const tiles: Stile[] = []

let pixelCounter = 0

for (let i = 0; i < data.length; i += 4) {
	const red = data[i]
	const green = data[i + 1]
	const blue = data[i + 2]
	const alpha = data[i + 3]

	if (alpha < 127) {
		pixelCounter += 1

		continue
	}

	const rgb: RGBColor = {
		r: red,
		g: green,
		b: blue,
	}

	const nearestColor = NearestColor(Object.values(SorterIDToColor), rgb)

	const sorterID = parseInt(
		Object.keys(SorterIDToColor)[
			Object.values(SorterIDToColor).indexOf(nearestColor as any)
		],
		10
	) as SorterID

	tiles.push(
		new Stile(
			'sorter',
			new Point2(
				new Int(width - (pixelCounter % width)),
				new Int(height - Math.floor(pixelCounter / height))
			),
			new Content(new Byte(0), new Short(sorterID)),
			new Byte(0)
		)
	)

	pixelCounter += 1
}

const schematic = new Schematic(
	new Byte(1),
	tiles,
	{
		name: 'Pixel Art',
		description: 'Generated by mindustry-utils',
		labels: '["Pixel Art"]',
	},
	new Short(width),
	new Short(height)
)

const schemBuffer = await GenerateMSCH(schematic)
// console.log(tiles)

const base64 = schemBuffer.toString('base64')

await fs.writeFile(
	path.join(__dirname, '../data/output.png'),
	canvas.toBuffer('image/png')
)

await fs.writeFile(path.join(__dirname, '../data/output.txt'), base64)
