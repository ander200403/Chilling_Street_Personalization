// URL de tu Excel específico para el Studio
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

// Convertidor de URL de Drive SEGURO para Canvas (Evita el bloqueo de Tainted Canvas)
function getStableImageUrl(rawImg) {
  if (!rawImg) return '';
  if (rawImg.indexOf('drive.google.com') !== -1) {
    const matchD = rawImg.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const matchId = rawImg.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const driveId = (matchD && matchD[1]) || (matchId && matchId[1]);
    if (driveId) {
      const driveUrl = 'https://drive.google.com/uc?export=view&id=' + driveId;
      // Usamos un proxy de imágenes para evitar bloqueos de seguridad del navegador al fusionar el diseño
      return 'https://wsrv.nl/?url=' + encodeURIComponent(driveUrl) + '&output=png';
    }
  }
  return rawImg;
}

// Inicializar el Canvas con Fabric.js
function initCanvas() {
  const container = document.getElementById('canvasContainer');
  const width = container.clientWidth;
  const height = width * 1.25; // Proporción 4:5 estilo ropa

  canvas = new fabric.Canvas('tshirtCanvas', {
    width: width,
    height: height,
    preserveObjectStacking: true
  });
}

// Cargar inventario de prendas base desde el Excel
async function loadStudioData() {
  try {
    const tstamp = new Date().getTime();
    const res = await fetch(URL_CSV_STUDIO + "&t=" + tstamp);
    const rawData = await res.text();

    Papa.parse(rawData, {
      header: false,
      skipEmptyLines: true,
      complete: function(results) {
        const rows = results.data.slice(1);
        
        garments = rows.map((cols, index) => {
          return {
            id: cols[0] || index,
            name: cols[1] || 'Prenda',
            color: cols[2] || '',
            img: getStableImageUrl(cols[3] ? cols[3].trim() : '')
          };
        }).filter(g => g.img !== '');

        renderGarments();
        if(garments.length > 0) {
          selectGarment(0); // Auto-selecciona la primera prenda
        } else {
          document.getElementById('garmentTrack').innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem;">No hay prendas configuradas en el Excel.</p>';
        }
      }
    });
  } catch(e) {
    console.error("Error cargando prendas de estudio:", e);
    showToast("Error de conexión con la base de datos");
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

// Poner la prenda de fondo en el lienzo
function selectGarment(index) {
  const g = garments[index];
  if (!g || !canvas) return;

  showToast("Cargando prenda...");

  fabric.Image.fromURL(g.img, function(img) {
    // Escalar imagen para que cubra el canvas perfectamente
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
  }, { crossOrigin: 'anonymous' }); // Clave para evitar error CORS
}

// Subir el logo del cliente y colocarlo sobre la ropa
document.getElementById('logoUpload').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(f) {
    const data = f.target.result;
    fabric.Image.fromURL(data, function(img) {
      // Escalar logo a un tamaño prudente inicial (40% del ancho del lienzo)
      img.scaleToWidth(canvas.width * 0.4); 
      img.set({
        left: canvas.width / 2,
        top: canvas.height / 2.5,
        originX: 'center',
        originY: 'center',
        borderColor: '#ffffff',
        cornerColor: '#ffffff',
        cornerSize: 12,
        transparentCorners: false
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      showToast("¡Logo añadido! Arrástralo a tu gusto.");
    });
  };
  reader.readAsDataURL(file);
});

function removeSelectedObj() {
  const activeObj = canvas.getActiveObject();
  if (activeObj) {
    canvas.remove(activeObj);
  } else {
    showToast("⚠️ Toca un logo primero para borrarlo");
  }
}

// Empaquetar diseño, descargar y enviar a WhatsApp
function downloadAndSendOrder() {
  if(canvas.getObjects().length === 0) {
    showToast("⚠️ Añade al menos un logo antes de enviar");
    return;
  }

  // Quitar el cuadro de selección visual antes de tomar la foto final
  canvas.discardActiveObject();
  canvas.renderAll();

  showToast("⏳ Procesando diseño en alta calidad...");

  setTimeout(() => {
    try {
      // 1. Generar la foto final fusionada
      const dataURL = canvas.toDataURL({
        format: 'png',
        multiplier: 2 // Exportar en alta resolución
      });

      // 2. Forzar descarga en el dispositivo del cliente
      const link = document.createElement('a');
      link.download = 'Chilling_Studio_Design.png';
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 3. Abrir WhatsApp con el texto preparado
      const msg = encodeURIComponent("⚡ *CHILLING STUDIO* ⚡\n\nHola, acabo de crear un diseño personalizado en la plataforma.\n\n_En un momento te adjunto la imagen de cómo quiero que quede, que se acaba de guardar en mi galería._");
      
      setTimeout(() => {
        window.open('https://wa.me/' + WHATSAPP + '?text=' + msg);
      }, 1500);

    } catch(err) {
      console.error(err);
      showToast("❌ Error al procesar imagen. Intenta con otro logo.");
    }
  }, 800);
}

// Inicializar todo al abrir la página
window.onload = () => {
  initCanvas();
  loadStudioData();
};
