// DOM
const main = document.getElementById('main');
const _console = document.getElementById('console');
const _input = document.getElementById('input');
const config_container = document.getElementById('config_container');
const _c_preview_view = document.getElementById('_c_preview_view');
const _c_preview_hide = document.getElementById('_c_preview_hide');
const _c_wipe_docs = document.getElementById('_c_wipe_docs');
const _c_restore_docs = document.getElementById('_c_restore_docs');
const _c_delete_page = document.getElementById('_c_delete_page');
const _c_rotate_doc = document.getElementById('_c_rotate_doc');
const _c_move_doc_left = document.getElementById('_c_move_doc_left');
const _c_move_doc_right = document.getElementById('_c_move_doc_right');
const preview_container = document.getElementById('preview_container');
const preview_canvas = document.getElementById('preview_canvas');
const multipage_help = document.getElementById('multipage_help');
const multipage_prev = document.getElementById('multipage_prev');
const multipage_next = document.getElementById('multipage_next');
const multipage_count = document.getElementById('multipage_count');
const action_button_trim = document.getElementById('action_button_trim');
const action_button_split = document.getElementById('action_button_split');

// -------------------- GLOBALS ----------------------------

// Structs
var fileBuffers = [null];
var PDFDocs = [null];
var numPages = [null];
var pageHelp = 
{
	current: null,
	total: null,
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

// Resets
function resetFileBuffers()
{
	fileBuffers = [];
}
function resetPDFDocs()
{
	PDFDocs = [];
}
function resetNumPages()
{
	numPages = [];
}
function resetPageHelp()
{
	pageHelp = 
	{
		current: 1,
		total: null,
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

// ---------------------------------------------------------

// -------------------- MULTIDOC ---------------------------

// Which doc is a page
function whatDoc(i)
{
	var docIndex = 0;
	var pageIndex = i;
	for(let j = 0; j < PDFDocs.length; j++)
	{
		if(pageIndex > numPages[j])
		{
			// Page index out of bounds
			pageIndex -= numPages[j];
			docIndex++;
			continue;
		}
		// Page index in bounds
		else
		{
			return docIndex;
		}
	}
}

// Which page within a doc is a page
function whatPage(i)
{
	var pageIndex = i;
	for(let j = 0; j < PDFDocs.length; j++)
	{
		if(pageIndex > numPages[j])
		{
			// Page index out of bounds
			pageIndex -= numPages[j];
			continue;
		}
		// Page index in bounds
		else
		{
			return pageIndex;
		}
	}
}

// Updates the page label
function updatePageCount()
{
	multipage_count.innerHTML = 'p:' + (whatPage(pageHelp.current)) + '/' + (numPages[whatDoc(pageHelp.current)]) + ', ';
	multipage_count.innerHTML += 'd:' + (whatDoc(pageHelp.current) + 1) + '/' + (whatDoc(pageHelp.total) + 1) + ', ';
	multipage_count.innerHTML += 't:' + pageHelp.current + '/' + pageHelp.total;
}

// ---------------------------------------------------------

// -------------------- RENDER -----------------------------

// Blocking
var renderInProgress = false;

// Resolves what doc and renders that page
async function renderPDFPage(i)
{
	var page;
	var pageIndex = i;

	// Loop through docs until the index is within the doc's range
	for(let j = 0; j < PDFDocs.length; j++)
	{
		if(pageIndex > numPages[j])
		{
			// Page index out of bounds
			pageIndex -= numPages[j];
			continue;
		}
		// Page index in bounds
		else
		{
			page = await PDFDocs[j].getPage(pageIndex);
			break;
		}
	}

	// Set up canvases
	const viewport = page.getViewport({scale: CONST_DPI/72});
	canvas.width = viewport.width >= 600 ? 600 : viewport.width;
	canvas.height = viewport.height >= 600 ? 600: viewport.height;
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
	pageHelp.current += i;
	await renderPDFPage(pageHelp.current);
	draw();
	if(i != 0) updatePageCount();
	renderInProgress = false;
}

// Swap subarrays
function swapRight(arr, i, j, l, k)
{
	const a = arr.slice(i, i + l);
	const b = arr.slice(j, j + k);
	arr.splice(i, l + k, ...b, ...a);
}

// Wrap for swapping documents
async function renderSwapWrap(docpos, i)
{
	renderInProgress = true;
	let pagepos = 0;
	if(docpos != 0)
	{
		for(let j = 0; j < docpos; j++)
		{
			pagepos += numPages[j];
		}
	}
	if(i == 1)
	{
		swapRight(pageHelp.rotate, pagepos, pagepos + numPages[docpos], numPages[docpos], numPages[docpos + 1]);
		swapRight(pageHelp.delete, pagepos, pagepos + numPages[docpos], numPages[docpos], numPages[docpos + 1]);
	}
	else if(i == -1)
	{
		swapRight(pageHelp.rotate, pagepos - numPages[docpos - 1], pagepos, numPages[docpos - 1], numPages[docpos]);
		swapRight(pageHelp.delete, pagepos - numPages[docpos - 1], pagepos, numPages[docpos - 1], numPages[docpos]);
	}
	const tempFB = fileBuffers[docpos];
	const tempPD = PDFDocs[docpos];
	const tempNP = numPages[docpos];
	fileBuffers[docpos] = fileBuffers[docpos + i];
	PDFDocs[docpos] = PDFDocs[docpos + i];
	numPages[docpos] = numPages[docpos + i];
	fileBuffers[docpos + i] = tempFB;
	PDFDocs[docpos + i] = tempPD;
	numPages[docpos + i] = tempNP;
	await renderPDFPage(pageHelp.current);
	draw();
	updatePageCount();
	renderInProgress = false;
}

// -------------------- CONSOLE ----------------------------

function printConsole(text)
{
	_console.value += text;
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
const CONST_DPI = 144;
const CONST_ZOOMFACTOR = 1.1;
const CONST_MOBILEZOOMFACTOR = 1.05;

// Draw, vCanvas into canvas
function draw()
{
	// Apply pan and zoom
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.imageSmoothingEnabled = false;
	context.setTransform(previewWindow.scale, 0, 0, previewWindow.scale, previewWindow.offsetX, previewWindow.offsetY);

	// Apply rotation
	if(pageHelp.rotate[pageHelp.current - 1] != 0)
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
	press(e.clientX, e.clientY);
});
canvas.addEventListener('mousemove', (e)=>
{
	e.preventDefault();
	move(e.clientX, e.clientY);
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
		press(e.touches[0].clientX, e.touches[0].clientY);
	}
	else if(e.touches.length == 2)
	{
		mobileStartZoom(e.touches[0], e.touches[1]);
	}
}, {passive: false});
canvas.addEventListener('touchmove', function(e)
{
	e.preventDefault();
	if(e.touches.length == 1)
	{
		move(e.touches[0].clientX, e.touches[0].clientY);
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

// View preview
_c_preview_view.addEventListener('click', function()
{
	preview_container.classList.toggle('hidden');
	main.classList.toggle('blurred');
});

// Hide preview
_c_preview_hide.addEventListener('click', function()
{
	preview_container.classList.toggle('hidden');
	main.classList.toggle('blurred');
});

// Multipage previous page
multipage_prev.addEventListener('click', async function()
{
	if(pageHelp.current != 1 && !renderInProgress)
	{
		await renderMoveWrap(-1);
	}
});

// Multipage next page
multipage_next.addEventListener('click', async function()
{
	if(pageHelp.current != pageHelp.total && !renderInProgress)
	{
		await renderMoveWrap(1);
	}
});

// Wipe all pages
_c_wipe_docs.addEventListener('click', ()=>
{
	for(let i = 1; i <= pageHelp.total; i++)
	{
		pageHelp.delete[i - 1] = 1;
	}

	draw();
})

// Restore deletions
_c_restore_docs.addEventListener('click', ()=>
{
	for(let i = 1; i <= pageHelp.total; i++)
	{
		pageHelp.delete[i - 1] = 0;
	}

	draw();
})

// Delete current page
_c_delete_page.addEventListener('click', ()=>
{
	pageHelp.delete[pageHelp.current - 1] = pageHelp.delete[pageHelp.current - 1] == 0 ? 1 : 0;

	draw();
})

// Rotate current page
_c_rotate_doc.addEventListener('click', ()=>
{
	pageHelp.rotate[pageHelp.current - 1] = (pageHelp.rotate[pageHelp.current - 1] + 1) % 4;

	draw();
})

// Move doc left
_c_move_doc_left.addEventListener('click', async function()
{
	let curr_doc_num = whatDoc(pageHelp.current);
	if(curr_doc_num != 0 && !renderInProgress)
	{
		await renderSwapWrap(curr_doc_num, -1);
	}
});

// Move doc right
_c_move_doc_right.addEventListener('click', async function()
{
	let curr_doc_num = whatDoc(pageHelp.current);
	if(curr_doc_num != PDFDocs.length - 1 && !renderInProgress)
	{
		await renderSwapWrap(curr_doc_num, 1);
	}
});

// ---------------------------------------------------------

// ---------------------------------------------------------

// -------------------- LOGIC ------------------------------

// Input
pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';
_input.onchange = async (e) =>
{
	// Hide
	preview_container.classList.add('hidden');
	config_container.classList.add('hidden');
	_c_wipe_docs.classList.add('hidden');
	_c_restore_docs.classList.add('hidden');
	_c_delete_page.classList.add('hidden');
	_c_move_doc_left.classList.add('hidden');
	_c_move_doc_right.classList.add('hidden');
	multipage_help.classList.add('hidden');

	// Reset
	resetConsole();
	resetFileBuffers();
	resetPDFDocs();
	resetNumPages();
	resetPageHelp();
	resetPreviewWindow();

	// Get files
	const files = e.target.files;
	if(!files)
	{
		printConsole("Error: Received 0 files.\n");
	}
	else if(files.length >= 20)
	{
		printConsole("Error: Received over 20 files.\n");
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
		fileBuffers.push(fileBuffer.slice(0));
		PDFDocs.push(await pdfjsLib.getDocument({data: fileBuffer}).promise);
		numPages.push(PDFDocs[i].numPages);
		pageHelp.total += PDFDocs[i].numPages;
		for(let j = 0; j < PDFDocs[i].numPages; j++)
		{
			pageHelp.rotate.push(0);
			pageHelp.delete.push(0);
		}
	}

	// Render 1st page
	await renderMoveWrap(0);

	// Enable UI
	config_container.classList.remove('hidden');
	if(PDFDocs.length > 1 || numPages[0] > 1)
	{
		if(PDFDocs.length > 1)
		{
			_c_move_doc_left.classList.remove('hidden');
			_c_move_doc_right.classList.remove('hidden');
		}
		_c_restore_docs.classList.remove('hidden');
		_c_wipe_docs.classList.remove('hidden');
		_c_delete_page.classList.remove('hidden');
		multipage_help.classList.remove('hidden');
		updatePageCount();
	}
}

async function action(split)
{
	// Abort nonsense
	let r = 0;
	let d = 0;
	for(let i = 0; i < pageHelp.total; i++)
	{
		if(pageHelp.delete[i] != 0)
		{
			d++;
		}
		else if(pageHelp.rotate[i] != 0)
		{
			r++;
		}
	}
	if(d == pageHelp.total)
	{
		printConsole("Aborting download of zero pages.\n");
		return;
	}
	else if(d == 0 && r == 0)
	{
		if(split == false || ((split == true) && (fileBuffers.length == 1) && (numPages[0] == 1)))
		{
			printConsole("Aborting download of unchanged document.\n");
			return;
		}
	}

	// Load PDF
	const {PDFDocument} = PDFLib;
	const newDoc = await PDFDocument.create();

	// Loop throgh all pages and rotate and copy
	let pageIndex = 0;
	for(let i = 0; i < fileBuffers.length; i++)
	{
		if(i != 0)
		{
			pageIndex += numPages[i - 1];
		}
		const pdf = await PDFDocument.load(fileBuffers[i]);
		// Rotate
		for(let j = 1; j <= numPages[i]; j++)
		{
			if(pageHelp.rotate[pageIndex + j - 1] != 0)
			{
				const pageToRotate = (pdf.getPages())[j - 1];
				pageToRotate.setRotation(PDFLib.degrees(pageToRotate.getRotation().angle + (pageHelp.rotate[pageIndex + j - 1]) * 90));
			}
		}
		const copy = await newDoc.copyPages(pdf, pdf.getPageIndices());
		copy.forEach((page) => newDoc.addPage(page));
	}

	// Loop through all pages and delete
	pageIndex = fileBuffers.length - 1;
	for(let i = fileBuffers.length - 1; i >= 0; i--)
	{
		if(i != fileBuffers.length - 1)
		{
			pageIndex -= numPages[i + 1];
		}
		// Delete or download
		for(let j = 1; j <= numPages[i]; j++)
		{	
			if(split && pageHelp.delete[pageIndex - j + 1] == 0)
			{
				// Copy
				const singlePage = await PDFDocument.create();
				const [copy] = await singlePage.copyPages(newDoc, [pageIndex - j + 1]);
				singlePage.addPage(copy);
		
				// Download
				const pageBytes = await singlePage.save();
				const blob = new Blob([pageBytes], {type: 'application/pdf'});
				const link = document.createElement('a');
				link.href = URL.createObjectURL(blob);
				link.download = `converted-${pageIndex - j + 1}` + '.pdf';
				link.click();
				URL.revokeObjectURL(link.href);
				continue;
			}
			if(pageHelp.delete[pageIndex - j + 1] == 1)
			{
				newDoc.removePage(pageIndex - j + 1);
			}
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
	link.download = 'merged' + '.pdf';
	link.click();
	URL.revokeObjectURL(link.href);
}

action_button_trim.addEventListener('click', async function()
{
	resetConsole();

	action(false);
});

action_button_split.addEventListener('click', async function()
{
	resetConsole();

	action(true);
});

// ---------------------------------------------------------