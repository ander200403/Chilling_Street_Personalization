// Enlace de tu nuevo Excel de Prendas Base
const URL_CSV_STUDIO = "https://docs.google.com/spreadsheets/d/1oO7FElJCkPrsiHdoanfgbi5qifec4XCd8j-Ya1Q0m_A/export?format=csv&gid=0";
const WHATSAPP = "584125713381";

let garments = [];
let canvas;

function showToast(msg) {
  const toast = document.getElementById('toast');
  if(!toast) return;
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// Convertidor de URL de Drive seguro
function getStableImageUrl(rawImg) {
  if (!rawImg) return '';
  if (rawImg.indexOf('drive.google.com') !== -1) {
    const matchD = rawImg.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const matchId = rawImg.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const driveId = (matchD && matchD[1]) || (matchId && matchId[1]);
    if (driveId) return 'https://drive.google.com/uc?export=view&id=' + driveId;
  }
  return rawImg;
}

// Inicializar el Canvas con Fabric.js
function initCanvas() {
  const container = document.getElementById('canvasContainer');
  const width = container.clientWidth;
  const height = width * 1.25; // Proporción 4:5

  canvas = new fabric.Canvas('tshirtCanvas', {
    width: width,
    height: height,
    preserveObjectStacking: true
  });
}

// Cargar inventario de prendas base desde el nuevo Excel
async function loadStudioData() {
  try {
    const tstamp = new Date().getTime();
    const res = await fetch(URL_CSV_STUDIO + "&t=" + tstamp);
    const rawData = await res.text();

    Papa.parse(rawData, {
      header: false,
      skipEmptyLines: true,
      complete: function(results) {
        // Asumimos que la fila 1 son los títulos
        const rows = results.data.slice(1);
        
        garments = rows.map((cols, index) => {
          /* ATENCIÓN AL ORDEN DEL EXCEL:
             Columna A (0): ID
             Columna B (1): Nombre
             Columna C (2): Color
             Columna D (3): Link de Drive
          */
          return {
            id: cols[0] || index,
            name: cols[1] || 'Prenda',
            color: cols[2] || '',
            img: getStableImageUrl(cols[3] ? cols[3].trim() : '')
          };
        }).filter(g => g.img !== '');

        renderGarments();
        if(garments.length > 0) {
          selectGarment(0); // Seleccionar la primera por defecto
        }
      }
    });
  } catch(e) {
    console.error("Error cargando prendas de estudio:", e);
    showToast("Error de conexión");
  }
}

function renderGarments() {
  const track = document.getElementById('garmentTrack');
  track.innerHTML = garments.map((g, i) => `
    <div class="garment-thumb" onclick="selectGarment(${i})">
      <img src="${g.img}" alt="${g.name}">
      <div class="garment-thumb-name">${g.name} ${g.color}</div>
    </div>
  `).join('');
}

// Cambiar la imagen de fondo del lienzo
function selectGarment(index) {
  const g = garments[index];
  if (!g || !canvas) return;

  fabric.Image.fromURL(g.img, function(img) {
    // Escalar imagen para cubrir el canvas
    const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
    img.set({
      originX: 'center',
      originY: 'center',
      left: canvas.width / 2,
      top: canvas.height / 2,
      scaleX: scale,
      scaleY: scale
    });
    
    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
    showToast(`Lienzo: ${g.name}`);
  }, { crossOrigin: 'anonymous' });
}

// Subir el logo y ponerlo sobre la ropa
document.getElementById('logoUpload').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(f) {
    const data = f.target.result;
    fabric.Image.fromURL(data, function(img) {
      // Escalar logo a un tamaño prudente
      img.scaleToWidth(canvas.width * 0.4); 
      img.set({
        left: canvas.width / 2,
        top: canvas.height / 2,
        originX: 'center',
        originY: 'center',
        borderColor: '#ffffff',
        cornerColor: '#ffffff',
        cornerSize: 12,
        transparentCorners: false
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      showToast("¡Logo añadido! Arrástralo.");
    });
  };
  reader.readAsDataURL(file);
});

function removeSelectedObj() {
  const activeObj = canvas.getActiveObject();
  if (activeObj) {
    canvas.remove(activeObj);
  } else {
    showToast("Toca un logo para borrarlo");
  }
}

// Empaquetar y Enviar
function downloadAndSendOrder() {
  if(canvas.getObjects().length === 0) {
    showToast("⚠️ Añade un logo antes de enviar");
    return;
  }

  // Quitar la selección visual (el cuadrito de edición) antes de la foto
  canvas.discardActiveObject();
  canvas.renderAll();

  showToast("⏳ Generando diseño...");

  setTimeout(() => {
    // 1. Tomar la foto HD
    const dataURL = canvas.toDataURL({
      format: 'png',
      multiplier: 2 // Alta calidad
    });

    // 2. Descargarla automáticamente
    const link = document.createElement('a');
    link.download = 'Chilling_Studio_Design.png';
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 3. Abrir WhatsApp
    const msg = encodeURIComponent("⚡ *CHILLING STUDIO* ⚡\n\nHola, acabo de crear un diseño personalizado en la tienda.\n\n_En un momento te adjunto la imagen de cómo quiero que quede, que se acaba de descargar en mi teléfono/PC._");
    
    setTimeout(() => {
      window.open('https://wa.me/' + WHATSAPP + '?text=' + msg);
    }, 1500);

  }, 500);
}

// Inicializar al cargar
window.onload = () => {
  initCanvas();
  loadStudioData();
};
