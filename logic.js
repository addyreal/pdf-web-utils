// DOM
const main = document.getElementById('main');
const _console = document.getElementById('console');
const _input = document.getElementById('input');
const _c_highdpi = document.getElementById('_c_highdpi');
const config_container = document.getElementById('config_container');
const _c_preview_view = document.getElementById('_c_preview_view');
const _c_preview_hide = document.getElementById('_c_preview_hide');
const _c_wipe_pages = document.getElementById('_c_wipe_pages');
const _c_restore_pages = document.getElementById('_c_restore_pages');
const _c_delete_page = document.getElementById('_c_delete_page');
const _c_crop_page = document.getElementById('_c_crop_page');
const _c_rotate_page = document.getElementById('_c_rotate_page');
const _c_move_page_left = document.getElementById('_c_move_page_left');
const _c_move_page_right = document.getElementById('_c_move_page_right');
const preview_container = document.getElementById('preview_container');
const preview_canvas = document.getElementById('preview_canvas');
const multipage_help = document.getElementById('multipage_help');
const multipage_prev = document.getElementById('multipage_prev');
const multipage_next = document.getElementById('multipage_next');
const multipage_count = document.getElementById('multipage_count');
const _c_split_label = document.getElementById('_c_split_label');
const _c_split = document.getElementById('_c_split');
const action_button = document.getElementById('action_button');
const bottom_info = document.getElementById('bottom_info');

const {PDFDocument} = PDFLib;

// -------------------- GLOBALS ----------------------------

// Structs
var split = false;
var isCropping = false;
var PDFPagesRender = [null];
var PDFPagesProcess = [null];
var pageHelp = 
{
	current: null,
	total: null,
	sizes: [{pw: null, ph: null},],
	crops: [{x: null, y: null, w: null, h: null},],
	delete: [null],
	rotate: [null],
};
var previewWindow =
{
	scale: null,
	lastTouchesDist: null,
	lastX: null,
	lastY: null,
	offsetX: null,
	offsetY: null,
	isDragging: null,
	isTouchZooming: null,
};
var cropRect =
{
	x: 0,
	y: 0,
	w: 0,
	h: 0,
	lastX: 0,
	lastY: 0,
	offsetX: 0,
	offsetY: 0,
	vertex: 0,
	dragging: false,
};

// Resets
function resetPDFPagesRender()
{
	PDFPagesRender = [];
}
function resetPDFPagesProcess()
{
	PDFPagesProcess = [];
}
function resetPageHelp()
{
	pageHelp = 
	{
		current: 1,
		total: null,
		sizes: [],
		crops: [],
		delete: [],
		rotate: [],
	};
}
function resetPreviewWindow()
{
	previewWindow =
	{
		scale: 1,
		lastTouchesDist: 0,
		lastX: 0,
		lastY: 0,
		offsetX: 0,
		offsetY: 0,
		isDragging: false,
		isTouchZooming: false,
	};
}
function resetCurrentCrop(box)
{
	cropRect =
	{
		x: 0,
		y: 0,
		w: box.width - 1,
		h: box.height - 1,
		lastX: 0,
		lastY: 0,
		offsetX: 0,
		offsetY: 0,
		vertex: 0,
		dragging: false,
	};
}

// Utils
function saveCurrentCrop(box)
{
	const x = cropRect.x;
	const y = cropRect.y;
	const w = cropRect.w;
	const h = cropRect.h;
	pageHelp.crops[pageHelp.current - 1] = {x: x, y: y, w: w, h: h};
	const pw = box.width - 1;
	const ph = box.height - 1;
	pageHelp.sizes[pageHelp.current - 1] = {pw: pw, ph: ph};
}
function restoreCurrentCrop(index, box)
{
	if(pageHelp.crops[index].w != 0)
	{
		cropRect =
		{
			x: pageHelp.crops[index].x,
			y: pageHelp.crops[index].y,
			w: pageHelp.crops[index].w,
			h: pageHelp.crops[index].h,
			lastX: 0,
			lastY: 0,
			offsetX: 0,
			offsetY: 0,
			vertex: 0,
			dragging: false,
		};
	}
	else
	{
		resetCurrentCrop(box);
	}
}

// ---------------------------------------------------------

// -------------------- THING ------------------------------

// Updates the page label
function updatePageCount()
{
	multipage_count.innerHTML = pageHelp.current + '/' + pageHelp.total;
}

// ---------------------------------------------------------

// -------------------- RENDER -----------------------------

// Blocking
var renderInProgress = false;

// Resolves what doc and renders that page
async function renderPDFPage(i)
{
	// Pull page
	const page = PDFPagesRender[i];

	// Set up canvases
	const viewport = page.getViewport({scale: CONST_DPI/72});
	canvas.width = viewport.width >= 800 ? 800 : viewport.width;
	canvas.height = viewport.height >= 800 ? 800: viewport.height;
	vCanvas.width = viewport.width;
	vCanvas.height = viewport.height;

	// Render page
	const renderTask = page.render({canvasContext: vContext, viewport});
	await renderTask.promise;
}

// Wrap for moving between pages
async function renderMoveWrap(i)
{
	renderInProgress = true;
	saveCurrentCrop(vCanvas);
	pageHelp.current += i;
	await renderPDFPage(pageHelp.current - 1);
	restoreCurrentCrop(pageHelp.current - 1, vCanvas);
	draw();
	if(i != 0) updatePageCount();
	renderInProgress = false;
}

// Wrap for swapping documents
async function renderSwapWrap(index, i)
{
	renderInProgress = true;
	const tempPHR = pageHelp.rotate[index];
	const tempPHD = pageHelp.delete[index];
	const tempPHC = pageHelp.crops[index];
	const tempPHS = pageHelp.sizes[index];
	const tempPPR = PDFPagesRender[index];
	const tempPPP = PDFPagesProcess[index];
	pageHelp.rotate[index] = pageHelp.rotate[index + i];
	pageHelp.delete[index] = pageHelp.delete[index + i];
	pageHelp.crops[index] = pageHelp.crops[index + i];
	pageHelp.sizes[index] = pageHelp.sizes[index + i];
	PDFPagesRender[index] = PDFPagesRender[index + i];
	PDFPagesProcess[index] = PDFPagesProcess[index + i];
	pageHelp.rotate[index + i] = tempPHR;
	pageHelp.delete[index + i] = tempPHD;
	pageHelp.crops[index + i] = tempPHC;
	pageHelp.sizes[index + i] = tempPHS;
	PDFPagesRender[index + i] = tempPPR;
	PDFPagesProcess[index + i] = tempPPP;
	await renderPDFPage(pageHelp.current - 1);
	restoreCurrentCrop(pageHelp.current - 1, vCanvas);
	draw();
	updatePageCount();
	renderInProgress = false;
}

// -------------------- CONSOLE ----------------------------

function printConsole(text)
{
	_console.value += text;
	_console.scrollTop = _console.scrollHeight;
}
function resetConsole()
{
	_console.value = "";
}

// ---------------------------------------------------------

// -------------------- CANVAS -----------------------------

// Main canvas
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;

// Virtual canvas
const vCanvas = document.createElement('canvas');
const vContext = vCanvas.getContext('2d');
vContext.imageSmoothingEnabled = false;

// Constants
var CONST_DPI = 144;
const CONST_CROPTHICKNESS = 1;
const CONST_CROPSQUAREAREA = 16;
const CONST_ZOOMFACTOR = 1.1;
const CONST_MOBILEZOOMFACTOR = 10;

// Draw, vCanvas into canvas
function draw()
{
	// Apply pan and zoom
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.imageSmoothingEnabled = false;
	context.setTransform(previewWindow.scale, 0, 0, previewWindow.scale, previewWindow.offsetX, previewWindow.offsetY);

	// Apply rotation
	if(pageHelp.rotate[pageHelp.current - 1] != 0 && isCropping == false)
	{
		context.translate(vCanvas.width / 2, vCanvas.height / 2);
		context.rotate(pageHelp.rotate[pageHelp.current - 1] * Math.PI / 2);
		context.translate(-1 * vCanvas.width / 2, -1 * vCanvas.height / 2);
	}

	// Draw pdf
	context.drawImage(vCanvas, 0, 0);

	// Draw removal
	if(pageHelp.delete[pageHelp.current - 1] == 1)
	{
		context.strokeStyle = 'red';
		context.lineWidth = 2;
		context.fillStyle = 'rgba(0, 0, 0, 0.5)';
		context.fillRect(0, 0, vCanvas.width, vCanvas.height);

		context.beginPath();
		context.moveTo(0, 0);
		context.lineTo(vCanvas.width, vCanvas.height);
		context.stroke();

		context.beginPath();
		context.moveTo(vCanvas.width, 0);
		context.lineTo(0, vCanvas.height);
		context.stroke();
	}
	// Else draw cropbox
	else
	{
		const cropX = Math.round(cropRect.x);
		const cropY = Math.round(cropRect.y);
		const cropW = Math.round(cropRect.w);
		const cropH = Math.round(cropRect.h);

		if(isCropping == true)
		{
			context.fillStyle = 'red';
			context.fillRect(cropX + 1 - CONST_CROPSQUAREAREA, cropY + 1 - CONST_CROPSQUAREAREA, CONST_CROPSQUAREAREA, CONST_CROPSQUAREAREA);
			context.fillRect(cropX + 1 - CONST_CROPSQUAREAREA, cropY + cropH, CONST_CROPSQUAREAREA, CONST_CROPSQUAREAREA);
			context.fillRect(cropX + cropW, cropY + 1 - CONST_CROPSQUAREAREA, CONST_CROPSQUAREAREA, CONST_CROPSQUAREAREA);
			context.fillRect(cropX + cropW, cropY + cropH, CONST_CROPSQUAREAREA, CONST_CROPSQUAREAREA);
		}

		context.save();
		context.fillStyle = 'rgba(0, 0, 0, 0.25)';
		context.fillRect(cropX, cropY, cropW, cropH);
		context.restore();

		context.strokeStyle = 'rgba(255, 0, 0 , 0.6)';
		context.lineWidth = CONST_CROPTHICKNESS;
		context.strokeRect(cropX + CONST_CROPTHICKNESS/2, cropY + CONST_CROPTHICKNESS/2, cropW, cropH);
	}
}

// Click
function press(x, y)
{
	const rect = canvas.getBoundingClientRect();
	previewWindow.isDragging = true;
	previewWindow.isTouchZooming = false;
	previewWindow.lastX = x - rect.left;
	previewWindow.lastY = y - rect.top;
}

// Move
function move(x, y)
{
	if(!previewWindow.isDragging || previewWindow.isTouchZooming) return;
	const rect = canvas.getBoundingClientRect();

	const dx = x - rect.left - previewWindow.lastX;
	const dy = y - rect.top - previewWindow.lastY;

	previewWindow.offsetX += dx;
	previewWindow.offsetY += dy;

	previewWindow.lastX = x - rect.left;
	previewWindow.lastY = y - rect.top;

	draw();
}

// Zoom
function zoom(e)
{
	const rect = canvas.getBoundingClientRect();

	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;
	const scaleFactor = e.deltaY <= 0 ? CONST_ZOOMFACTOR : 1 / CONST_ZOOMFACTOR;

	const worldX = (mouseX - previewWindow.offsetX) / previewWindow.scale;
	const worldY = (mouseY - previewWindow.offsetY) / previewWindow.scale;

	previewWindow.scale *= scaleFactor;

	previewWindow.offsetX = mouseX - worldX * previewWindow.scale;
	previewWindow.offsetY = mouseY - worldY * previewWindow.scale;

	draw();
}

// End
function end()
{
	previewWindow.isDragging = false;
	cropRect.dragging = false;
	canvas.classList.remove('grabbing');
}

// Mobile
function getTouchesDist(touch1, touch2)
{
	const dx = touch1.clientX - touch2.clientX;
	const dy = touch1.clientY - touch2.clientY;
	return Math.hypot(dx, dy);
}
function getTouchesX(touch1, touch2)
{
	return (touch1.clientX + touch2.clientX)/2;
}
function getTouchesY(touch1, touch2)
{
	return (touch1.clientY + touch2.clientY)/2;
}
function mobileStartZoom(touch1, touch2)
{
	cropRect.dragging = false;
	previewWindow.isDragging = false;
	previewWindow.isTouchZooming = true;
	previewWindow.lastTouchesDist = getTouchesDist(touch1, touch2);
}
function mobileZoom(touch1, touch2)
{
	const rect = canvas.getBoundingClientRect();

	const touchX = getTouchesX(touch1, touch2) - rect.left;
	const touchY = getTouchesY(touch1, touch2) - rect.top;
	const scaleFactor = getTouchesDist(touch1, touch2) - previewWindow.lastTouchesDist <= 0 ? 1 / CONST_MOBILEZOOMFACTOR : CONST_MOBILEZOOMFACTOR;

	const worldX = (touchX - previewWindow.offsetX) / previewWindow.scale;
	const worldY = (touchY - previewWindow.offsetY) / previewWindow.scale;

	previewWindow.scale *= scaleFactor;

	previewWindow.offsetX = touchX - worldX * previewWindow.scale;
	previewWindow.offsetY = touchY - worldY * previewWindow.scale;

	previewWindow.lastTouchesDist = getTouchesDist(touch1, touch2);

	draw();
}
function mobileEnd()
{
	cropRect.dragging = false;
	previewWindow.isDragging = false;
	previewWindow.isTouchZooming = false;
}

// ---------------------------------------------------------

// -------------------- EVENT LISTENERS --------------------

// -------------------- CANVAS LISTENERS -------------------

// -------------------- PC IMPLEMENTATION ------------------

canvas.addEventListener('wheel', (e)=>
{
	e.preventDefault();
	zoom(e);
});
canvas.addEventListener('mousedown', (e)=>
{
	canvas.classList.add('grabbing');
	const rect = canvas.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;

	// Vertex grabbing
	const cropX = cropRect.x * previewWindow.scale + previewWindow.offsetX;
	const cropY = cropRect.y * previewWindow.scale + previewWindow.offsetY;
	const cropW = cropRect.w * previewWindow.scale;
	const cropH = cropRect.h * previewWindow.scale;
	if(isCropping == true &&
		mouseX >= cropX - previewWindow.scale - 10 &&
		mouseX <= cropX + previewWindow.scale + 10 &&
		mouseY >= cropY - previewWindow.scale - 10 &&
		mouseY <= cropY + previewWindow.scale + 10)
	{
		cropRect.lastX = (mouseX - previewWindow.offsetX) / previewWindow.scale;
		cropRect.lastY = (mouseY - previewWindow.offsetY) / previewWindow.scale;
		cropRect.offsetX = 0;
		cropRect.offsetY = 0;
		cropRect.vertex = 0;
		cropRect.dragging = true;
	}
	else if(isCropping == true &&
		mouseX >= cropX + cropW - previewWindow.scale - 10 &&
		mouseX <= cropX + cropW + previewWindow.scale + 10 &&
		mouseY >= cropY - previewWindow.scale - 10 &&
		mouseY <= cropY + previewWindow.scale + 10)
	{
		cropRect.lastX = (mouseX - previewWindow.offsetX) / previewWindow.scale;
		cropRect.lastY = (mouseY - previewWindow.offsetY) / previewWindow.scale;
		cropRect.offsetX = 0;
		cropRect.offsetY = 0;
		cropRect.vertex = 1;
		cropRect.dragging = true;
	}
	else if(isCropping == true &&
		mouseX >= cropX - previewWindow.scale - 10 &&
		mouseX <= cropX + previewWindow.scale + 10 &&
		mouseY >= cropY + cropH - previewWindow.scale - 10 &&
		mouseY <= cropY + cropH + previewWindow.scale + 10)
	{
		cropRect.lastX = (mouseX - previewWindow.offsetX) / previewWindow.scale;
		cropRect.lastY = (mouseY - previewWindow.offsetY) / previewWindow.scale;
		cropRect.offsetX = 0;
		cropRect.offsetY = 0;
		cropRect.vertex = 2;
		cropRect.dragging = true;
	}
	else if(isCropping == true &&
		mouseX >= cropX + cropW - previewWindow.scale - 10 &&
		mouseX <= cropX + cropW + previewWindow.scale + 10 &&
		mouseY >= cropY + cropH - previewWindow.scale - 10 &&
		mouseY <= cropY + cropH + previewWindow.scale + 10)
	{
		cropRect.lastX = (mouseX - previewWindow.offsetX) / previewWindow.scale;
		cropRect.lastY = (mouseY - previewWindow.offsetY) / previewWindow.scale;
		cropRect.offsetX = 0;
		cropRect.offsetY = 0;
		cropRect.vertex = 3;
		cropRect.dragging = true;
	}
	// Other grabbing (panning)
	else
	{
		press(e.clientX, e.clientY);
	}
});
canvas.addEventListener('mousemove', (e)=>
{
	e.preventDefault();
	const rect = canvas.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;

	// Vertex grabbing
	if(cropRect.dragging == true)
	{
		const newX = (mouseX - cropRect.offsetX - previewWindow.offsetX) / previewWindow.scale;
		const newY = (mouseY - cropRect.offsetY - previewWindow.offsetY) / previewWindow.scale;
		let dx = newX - cropRect.lastX;
		let dy = newY - cropRect.lastY;

		switch(cropRect.vertex)
		{
			case 0:
				cropRect.x += dx;
				cropRect.y += dy;
				cropRect.w -= dx;
				cropRect.h -= dy;
				break;
			case 1:
				cropRect.y += dy;
				cropRect.w += dx;
				cropRect.h -= dy;
				break;
			case 2:
				cropRect.x += dx;
				cropRect.w -= dx;
				cropRect.h += dy;
				break;
			case 3:
				cropRect.w += dx;
				cropRect.h += dy;
				break;
		}

		cropRect.lastX = newX;
		cropRect.lastY = newY;

		draw();
	}
	// Maybe other grabbing (panning)
	else
	{
		move(e.clientX, e.clientY);
	}
});
canvas.addEventListener('mouseup', ()=>
{
	end();
});
canvas.addEventListener('mouseleave', ()=>
{
	end();
});

// ---------------------------------------------------------

// -------------------- MOBILE IMPLEMENTATION --------------

canvas.addEventListener('touchstart', function(e)
{
	e.preventDefault();
	if(e.touches.length == 1)
	{
		const rect = canvas.getBoundingClientRect();
		const touchX = e.touches[0].clientX - rect.left;
		const touchY = e.touches[0].clientY - rect.top;

		// Vertex grabbing
		const cropX = cropRect.x * previewWindow.scale + previewWindow.offsetX;
		const cropY = cropRect.y * previewWindow.scale + previewWindow.offsetY;
		const cropW = cropRect.w * previewWindow.scale;
		const cropH = cropRect.h * previewWindow.scale;
		if(isCropping == true &&
			touchX >= cropX - previewWindow.scale - 20 &&
			touchX <= cropX + previewWindow.scale + 20 &&
			touchY >= cropY - previewWindow.scale - 20 &&
			touchY <= cropY + previewWindow.scale + 20)
		{
			cropRect.lastX = (touchX - previewWindow.offsetX) / previewWindow.scale;
			cropRect.lastY = (touchY - previewWindow.offsetY) / previewWindow.scale;
			cropRect.offsetX = 0;
			cropRect.offsetY = 0;
			cropRect.vertex = 0;
			cropRect.dragging = true;
		}
		else if(isCropping == true &&
			touchX >= cropX + cropW - previewWindow.scale - 20 &&
			touchX <= cropX + cropW + previewWindow.scale + 20 &&
			touchY >= cropY - previewWindow.scale - 20 &&
			touchY <= cropY + previewWindow.scale + 20)
		{
			cropRect.lastX = (touchX - previewWindow.offsetX) / previewWindow.scale;
			cropRect.lastY = (touchY - previewWindow.offsetY) / previewWindow.scale;
			cropRect.offsetX = 0;
			cropRect.offsetY = 0;
			cropRect.vertex = 1;
			cropRect.dragging = true;
		}
		else if(isCropping == true &&
			touchX >= cropX - previewWindow.scale - 20 &&
			touchX <= cropX + previewWindow.scale + 20 &&
			touchY >= cropY + cropH - previewWindow.scale - 20 &&
			touchY <= cropY + cropH + previewWindow.scale + 20)
		{
			cropRect.lastX = (touchX - previewWindow.offsetX) / previewWindow.scale;
			cropRect.lastY = (touchY - previewWindow.offsetY) / previewWindow.scale;
			cropRect.offsetX = 0;
			cropRect.offsetY = 0;
			cropRect.vertex = 2;
			cropRect.dragging = true;
		}
		else if(isCropping == true &&
			touchX >= cropX + cropW - previewWindow.scale - 20 &&
			touchX <= cropX + cropW + previewWindow.scale + 20 &&
			touchY >= cropY + cropH - previewWindow.scale - 20 &&
			touchY <= cropY + cropH + previewWindow.scale + 20)
		{
			cropRect.lastX = (touchX - previewWindow.offsetX) / previewWindow.scale;
			cropRect.lastY = (touchY - previewWindow.offsetY) / previewWindow.scale;
			cropRect.offsetX = 0;
			cropRect.offsetY = 0;
			cropRect.vertex = 3;
			cropRect.dragging = true;
		}
		// Other grabbing (panning)
		else
		{
			press(e.touches[0].clientX, e.touches[0].clientY);
		}
	}
	else if(e.touches.length == 2)
	{
		cropRect.dragging = false;
		mobileStartZoom(e.touches[0], e.touches[1]);
	}
}, {passive: false});
canvas.addEventListener('touchmove', function(e)
{
	e.preventDefault();
	if(e.touches.length == 1)
	{
		// Vertex grabbing
		if(cropRect.dragging == true)
		{
			const rect = canvas.getBoundingClientRect();
			const touchX = e.touches[0].clientX - rect.left;
			const touchY = e.touches[0].clientY - rect.top;
			const newX = (touchX - cropRect.offsetX - previewWindow.offsetX) / previewWindow.scale;
			const newY = (touchY - cropRect.offsetY - previewWindow.offsetY) / previewWindow.scale;
			let dx = newX - cropRect.lastX;
			let dy = newY - cropRect.lastY;
	
			switch(cropRect.vertex)
			{
				case 0:
					cropRect.x += dx;
					cropRect.y += dy;
					cropRect.w -= dx;
					cropRect.h -= dy;
					break;
				case 1:
					cropRect.y += dy;
					cropRect.w += dx;
					cropRect.h -= dy;
					break;
				case 2:
					cropRect.x += dx;
					cropRect.w -= dx;
					cropRect.h += dy;
					break;
				case 3:
					cropRect.w += dx;
					cropRect.h += dy;
					break;
			}
	
			cropRect.lastX = newX;
			cropRect.lastY = newY;
	
			draw();
		}
		// Maybe other grabbing (panning)
		else
		{
			move(e.touches[0].clientX, e.touches[0].clientY);
		}
	}
	else if(e.touches.length == 2)
	{
		mobileZoom(e.touches[0], e.touches[1]);
	}
}, {passive: false});
canvas.addEventListener('touchend', ()=>
{
	mobileEnd();
}, {passive: false});
canvas.addEventListener('touchcancel', ()=>
{
	mobileEnd();
}, {passive: false});

// ---------------------------------------------------------

// ---------------------------------------------------------

// -------------------- OTHER LISTENERS --------------------

// Enable highdpi render
_c_highdpi.addEventListener('change', (e) =>
{
	if(e.target.checked)
	{
		CONST_DPI = 288;
	}
	else
	{
		CONST_DPI = 144;
	}

	// Force reupload, pixel data is up/down-scaled
	resetConsole();
	config_container.classList.add('hidden');
});

// View preview
_c_preview_view.addEventListener('click', function()
{
	preview_container.classList.toggle('hidden');
	main.classList.toggle('blurred');
	bottom_info.classList.toggle('blurred');
});

// Hide preview
_c_preview_hide.addEventListener('click', function()
{
	if(isCropping == true) return;
	saveCurrentCrop(vCanvas);
	preview_container.classList.toggle('hidden');
	main.classList.toggle('blurred');
	bottom_info.classList.toggle('blurred');
});

// Multipage previous page
multipage_prev.addEventListener('click', async function()
{
	if(isCropping == true) return;
	if(pageHelp.current != 1 && !renderInProgress)
	{
		await renderMoveWrap(-1);
	}
});

// Multipage next page
multipage_next.addEventListener('click', async function()
{
	if(isCropping == true) return;
	if(pageHelp.current != pageHelp.total && !renderInProgress)
	{
		await renderMoveWrap(1);
	}
});

// Wipe all pages
_c_wipe_pages.addEventListener('click', ()=>
{
	if(isCropping == true) return;
	for(let i = 1; i <= pageHelp.total; i++) pageHelp.delete[i - 1] = 1;

	draw();
})

// Restore deletions
_c_restore_pages.addEventListener('click', ()=>
{
	if(isCropping == true) return;
	for(let i = 1; i <= pageHelp.total; i++) pageHelp.delete[i - 1] = 0;

	draw();
})

// Delete current page
_c_delete_page.addEventListener('click', ()=>
{
	if(isCropping == true) return;
	pageHelp.delete[pageHelp.current - 1] = pageHelp.delete[pageHelp.current - 1] == 0 ? 1 : 0;

	draw();
})

// Disable other functionality while cropping (why not)
function hideWhenCropping()
{
	_c_preview_hide.classList.toggle('notallowed');
	multipage_prev.classList.toggle('notallowed');
	multipage_next.classList.toggle('notallowed');
	_c_wipe_pages.classList.toggle('notallowed');
	_c_delete_page.classList.toggle('notallowed');
	_c_restore_pages.classList.toggle('notallowed');
	_c_rotate_page.classList.toggle('notallowed');
	_c_move_page_left.classList.toggle('notallowed');
	_c_move_page_right.classList.toggle('notallowed');
}

// Toggle cropping
_c_crop_page.addEventListener('click', ()=>
{
	// Dont start cropping when page is deleted
	if(pageHelp.delete[pageHelp.current - 1] == 1) return;
	// Toggle
	isCropping = isCropping == true ? false : true;
	_c_crop_page.classList.toggle('bg-gray');
	canvas.classList.toggle('crosshair');
	hideWhenCropping()
	// Redraw
	draw();
})

// Rotate current page
_c_rotate_page.addEventListener('click', ()=>
{
	if(isCropping == true) return;
	pageHelp.rotate[pageHelp.current - 1] = (pageHelp.rotate[pageHelp.current - 1] + 1) % 4;

	draw();
})

// Move page left
_c_move_page_left.addEventListener('click', async function()
{
	if(isCropping == true) return;
	if(pageHelp.current - 1 != 0 && !renderInProgress)
	{
		await renderSwapWrap(pageHelp.current - 1, -1);
	}
});

// Move page right
_c_move_page_right.addEventListener('click', async function()
{
	if(isCropping == true) return;
	if(pageHelp.current - 1 != pageHelp.total - 1 && !renderInProgress)
	{
		await renderSwapWrap(pageHelp.current - 1, 1);
	}
});

// ---------------------------------------------------------

// ---------------------------------------------------------

// -------------------- LOGIC ------------------------------

// Drag and drop overlay
_input.addEventListener('drop', (e) =>
{
	e.preventDefault();
	const files = e.dataTransfer.files;

	// Validate the drop
	if(!files || files.length === 0)
	{
		return;
	}
	else if(files.length >= 20)
	{
		printConsole("Error: Received over 20 files.\n");
		return;
	}

	// Transfer files to normal flow
	const dataTransfer = new DataTransfer();
	for(let i = 0; i < files.length; i++)
	{
		if(files[i].type == "application/pdf")
		{
			dataTransfer.items.add(files[i]);
		}
	}
	_input.files = dataTransfer.files;
	_input.dispatchEvent(new Event('change'));
});

// Input
pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';
_input.onchange = async (e) =>
{
	// Hide
	preview_container.classList.add('hidden');
	config_container.classList.add('hidden');
	_c_wipe_pages.classList.add('hidden');
	_c_restore_pages.classList.add('hidden');
	_c_delete_page.classList.add('hidden');
	_c_move_page_left.classList.add('hidden');
	_c_move_page_right.classList.add('hidden');
	_c_split_label.classList.add('hidden');
	multipage_help.classList.add('hidden');

	// Reset (starting all over)
	resetConsole();
	resetPDFPagesRender();
	resetPDFPagesProcess();
	resetPageHelp();
	resetPreviewWindow();

	// Get files
	const files = e.target.files;
	if(!files || files.length === 0)
	{
		printConsole("Error: Received 0 files.\n");
		return;
	}
	else if(files.length >= 20)
	{
		printConsole("Error: Received over 20 files.\n");
		return;
	}

	// Initialize
	for(let i = 0; i < files.length; i++)
	{
		// Assert format
		if(files[i].type != "application/pdf")
		{
			printConsole("Error: Received a non-PDF file.\n");
			return;
		}

		// Populate globals
		const fileBuffer = await files[i].arrayBuffer();
		const fileBuffer2 = fileBuffer.slice(0);
		const PDFDocRender = await pdfjsLib.getDocument({data: fileBuffer}).promise;
		const PDFDocProcess = await PDFDocument.load(fileBuffer2);
		for(let j = 0; j < PDFDocRender.numPages; j++)
		{
			const temp = await PDFDocument.create();
			const [temp2] = await temp.copyPages(PDFDocProcess, [j]);
			temp.addPage(temp2);
			const temp3 = await temp.save();
			PDFPagesProcess.push(temp3);
			PDFPagesRender.push(await PDFDocRender.getPage(j + 1));
			pageHelp.crops.push({x: 0, y: 0, w: 0, h: 0});
			pageHelp.sizes.push({pw: 0, ph: 0});
			pageHelp.rotate.push(0);
			pageHelp.delete.push(0);
			pageHelp.total++;
		}
	}

	// Render 1st page
	await renderMoveWrap(0);

	// Generate crop box
	resetCurrentCrop(vCanvas);
	draw();

	// Enable UI
	config_container.classList.remove('hidden');
	if(pageHelp.total > 1)
	{
		_c_move_page_left.classList.remove('hidden');
		_c_move_page_right.classList.remove('hidden');
		_c_restore_pages.classList.remove('hidden');
		_c_wipe_pages.classList.remove('hidden');
		_c_delete_page.classList.remove('hidden');
		multipage_help.classList.remove('hidden');
		_c_split_label.classList.remove('hidden');
		updatePageCount();
	}
}

// Util
function toPt(px)
{
	return px * (72/CONST_DPI);
}

// Convert
async function action(split)
{
	// Abort nonsense
	let d = 0;
	for(let i = 0; i < pageHelp.total; i++)
	{
		if(pageHelp.delete[i] != 0)
		{
			d++;
		}
	}
	if(d == pageHelp.total)
	{
		printConsole("Error: Aborting download of zero pages.\n");
		return;
	}

	// Load PDF
	const newDoc = await PDFDocument.create();

	// Loop throgh all pages and rotate and copy
	for(let i = 0; i < pageHelp.total; i++)
	{
		const doc = await PDFDocument.load(PDFPagesProcess[i]);
		const page = (doc.getPages())[0];

		// Nonzero crop
		if(pageHelp.crops[i].w != 0 && pageHelp.crops[i].h != 0)
		{
			const crop = pageHelp.crops[i];
			const width = pageHelp.sizes[i].pw;
			const height = pageHelp.sizes[i].ph;
			const a = Math.round(crop.x);
			const b = height - Math.round(crop.h) - Math.round(crop.y);
			const c = Math.round(crop.w);
			const d = Math.round(crop.h);
			const prevCrop = page.getCropBox();
			if(a != 0 || b != 0 || c != width || d != height)
			{
				page.setCropBox(toPt(a) + prevCrop.x, toPt(b) + prevCrop.y, toPt(c), toPt(d));
				printConsole("Done: Page " + (i + 1) + " cropped with params (" + (toPt(a)) + ", " + (toPt(b)) + ", " + (toPt(c)) + ", " + (toPt(d)) + ").\n");
			}
			if(prevCrop.x != 0 || prevCrop.y != 0 || Math.round(prevCrop.width) != toPt(c) || Math.round(prevCrop.height) != toPt(d))
			{
				printConsole("Info: Page " + (i + 1) + " had a cropbox prior to addition.\n");
			}
		}

		// Nonzero rotation
		if(pageHelp.rotate[i] != 0)
		{
			page.setRotation(PDFLib.degrees(page.getRotation().angle + (pageHelp.rotate[i]) * 90));
			printConsole("Done: Page " + (i + 1) + " rotated with angle " + (pageHelp.rotate[i] * 90) + "° clockwise.\n");
		}

		// Copy over
		const [copy] = await newDoc.copyPages(doc, [0]);
		newDoc.addPage(copy);
	}

	// Loop through all pages and delete
	for(let i = pageHelp.total - 1; i >= 0; i--)
	{
		// Delete or download
		if(split && pageHelp.delete[i] == 0)
		{
			// Copy
			const singlePage = await PDFDocument.create();
			const [copy] = await singlePage.copyPages(newDoc, [i]);
			singlePage.addPage(copy);
	
			// Download
			const pageBytes = await singlePage.save();
			const blob = new Blob([pageBytes], {type: 'application/pdf'});
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = `converted-${i + 1}` + '.pdf';
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
			link.click();
			URL.revokeObjectURL(link.href);
			continue;
		}
		if(pageHelp.delete[i] == 1)
		{
			newDoc.removePage(i);
			printConsole("Done: Page " + (i + 1) + " deleted.\n");
		}
	}

	// Download is done for split
	if(split) return;

	// Save
	newBytes = await newDoc.save();

	// Make bob
	const bob = new Blob([newBytes], {type: 'application/pdf'});
	const link = document.createElement('a');
	link.href = URL.createObjectURL(bob);
	link.download = 'converted' + '.pdf';
	link.target = '_blank';
	link.rel = 'noopener noreferrer';
	link.click();
	URL.revokeObjectURL(link.href);
}

_c_split.addEventListener('change', (e) =>
{
	if(e.target.checked)
	{
		split = true;
	}
	else
	{
		split = false;
	}
});

action_button.addEventListener('click', async function()
{
	resetConsole();

	action(split);
});

// ---------------------------------------------------------