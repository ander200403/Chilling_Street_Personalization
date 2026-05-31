// ── Configuración ───────────────────────────────────────────────
const URL_CSV_STUDIO = "https://docs.google.com/spreadsheets/d/1oO7FElJCkPrsiHdoanfgbi5qifec4XCd8j-Ya1Q0m_A/export?format=csv&gid=0";
const WHATSAPP = "584242193836";

let garments = [];
let canvas;
let currentGarmentIndex = -1;

// ── Toast ────────────────────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

// ── Spinner del canvas ───────────────────────────────────────────
function showCanvasSpinner(visible) {
  const el = document.getElementById('canvasSpinner');
  if (!el) return;
  el.classList.toggle('hidden', !visible);
}

// ── URL segura via proxy (evita tainted canvas) ──────────────────
function getStableImageUrl(rawImg) {
  if (!rawImg) return '';
  rawImg = rawImg.trim();
  let driveId = null;

  const matchD = rawImg.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const matchId = rawImg.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  driveId = (matchD && matchD[1]) || (matchId && matchId[1]);

  if (driveId) {
    const driveUrl = 'https://drive.google.com/uc?export=view&id=' + driveId;
    return 'https://wsrv.nl/?url=' + encodeURIComponent(driveUrl) + '&output=png&n=-1';
  }
  return rawImg;
}

// ── Inicializar canvas de Fabric ─────────────────────────────────
function initCanvas() {
  const container = document.getElementById('canvasContainer');
  const width = container.clientWidth;
  const height = Math.round(width * 1.25); // proporción 4:5

  canvas = new fabric.Canvas('tshirtCanvas', {
    width: width,
    height: height,
    preserveObjectStacking: true,
    selection: true,
  });

  // Ocultar spinner inicial después de init
  showCanvasSpinner(false);
}

// ── Cargar inventario desde Google Sheets ────────────────────────
async function loadStudioData() {
  try {
    const res = await fetch(URL_CSV_STUDIO + "&t=" + Date.now());

    if (!res.ok) throw new Error("HTTP " + res.status);

    const rawData = await res.text();

    Papa.parse(rawData, {
      header: false,
      skipEmptyLines: true,
      complete: function(results) {
        const rows = results.data.slice(1); // saltar fila de encabezados

        garments = rows
          .map((cols, index) => ({
            id: cols[0] || String(index),
            name: (cols[1] || 'Prenda').trim(),
            color: (cols[2] || '').trim(),
            img: getStableImageUrl(cols[3] || '')
          }))
          .filter(g => g.img !== '');

        renderGarments();

        if (garments.length > 0) {
          selectGarment(0);
        } else {
          document.getElementById('garmentTrack').innerHTML =
            '<p style="color:var(--text-muted);font-size:0.8rem;">No hay prendas configuradas en el Excel.</p>';
          showCanvasSpinner(false);
        }
      }
    });

  } catch (e) {
    console.error("Error cargando prendas:", e);
    showToast("⚠️ Error de conexión con la base de datos");
    showCanvasSpinner(false);
    document.getElementById('garmentTrack').innerHTML =
      '<p style="color:var(--error);font-size:0.8rem;">Error al cargar. Revisa tu conexión.</p>';
  }
}

// ── Renderizar miniaturas de prendas ─────────────────────────────
function renderGarments() {
  const track = document.getElementById('garmentTrack');
  track.innerHTML = garments.map((g, i) => `
    <div class="garment-thumb" id="thumb-${i}" onclick="selectGarment(${i})" title="${g.name} ${g.color}">
      <img src="${g.img}" alt="${g.name}" loading="lazy" onerror="this.style.opacity='0.3'">
      <div class="garment-thumb-name">${g.name} ${g.color}</div>
    </div>
  `).join('');
}

// ── Seleccionar prenda como fondo ────────────────────────────────
function selectGarment(index) {
  if (!canvas) return;
  if (index === currentGarmentIndex) return; // no recargar la misma

  const g = garments[index];
  if (!g) return;

  // Marcar thumb activo
  document.querySelectorAll('.garment-thumb').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  currentGarmentIndex = index;
  showCanvasSpinner(true);

  fabric.Image.fromURL(
    g.img,
    function(img) {
      if (!img || !img.width) {
        showToast("❌ No se pudo cargar la imagen");
        showCanvasSpinner(false);
        return;
      }

      const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
      img.set({
        originX: 'center',
        originY: 'center',
        left: canvas.width / 2,
        top: canvas.height / 2,
        scaleX: scale,
        scaleY: scale,
      });

      canvas.setBackgroundImage(img, () => {
        canvas.renderAll();
        showCanvasSpinner(false);
        showToast("✓ Prenda cargada");
      });
    },
    { crossOrigin: 'anonymous' }
  );
}

// ── Subir logo del cliente ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const logoUpload = document.getElementById('logoUpload');
  if (!logoUpload) return;

  logoUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Limpiar el input para permitir subir el mismo archivo otra vez
    this.value = '';

    const reader = new FileReader();
    reader.onload = function(ev) {
      fabric.Image.fromURL(ev.target.result, function(img) {
        // Escalar a 40 % del ancho del canvas
        const targetW = canvas.width * 0.4;
        img.scaleToWidth(targetW);

        img.set({
          left: canvas.width / 2,
          top: canvas.height / 2.5,
          originX: 'center',
          originY: 'center',
          borderColor: 'rgba(255,255,255,0.9)',
          cornerColor: '#ffffff',
          cornerSize: 14,
          cornerStyle: 'circle',
          transparentCorners: false,
        });

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        showToast("✓ Logo añadido — arrastra y ajusta");
      });
    };
    reader.readAsDataURL(file);
  });
});

// ── Borrar objeto seleccionado ───────────────────────────────────
function removeSelectedObj() {
  if (!canvas) return;
  const activeObj = canvas.getActiveObject();
  if (activeObj) {
    canvas.remove(activeObj);
    canvas.discardActiveObject();
    canvas.renderAll();
    showToast("🗑️ Logo eliminado");
  } else {
    showToast("⚠️ Toca un logo primero para borrarlo");
  }
}

// ── Exportar diseño y abrir WhatsApp ────────────────────────────
function downloadAndSendOrder() {
  if (!canvas) return;

  if (canvas.getObjects().length === 0) {
    showToast("⚠️ Añade al menos un logo antes de enviar");
    return;
  }

  const btn = document.getElementById('sendBtn');
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Procesando..."; }

  canvas.discardActiveObject();
  canvas.renderAll();

  // Pequeño delay para que el render termine antes de exportar
  setTimeout(() => {
    try {
      const dataURL = canvas.toDataURL({
        format: 'png',
        multiplier: 2,
      });

      // Forzar descarga
      const link = document.createElement('a');
      link.download = 'Chilling_Studio_Diseño.png';
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast("✓ Imagen guardada. Abriendo WhatsApp…");

      const msg = encodeURIComponent(
        "⚡ *CHILLING STUDIO* ⚡\n\n" +
        "Hola, acabo de crear un diseño personalizado en la plataforma.\n\n" +
        "_Te adjunto la imagen del diseño que se guardó en mi galería._"
      );

      setTimeout(() => {
        window.open('https://wa.me/' + WHATSAPP + '?text=' + msg, '_blank');
        if (btn) { btn.disabled = false; btn.textContent = "⚡ 4. ENVIAR DISEÑO A WHATSAPP"; }
      }, 1200);

    } catch (err) {
      console.error("Error al exportar:", err);
      showToast("❌ Error al procesar imagen. Intenta con otro logo.");
      if (btn) { btn.disabled = false; btn.textContent = "⚡ 4. ENVIAR DISEÑO A WHATSAPP"; }
    }
  }, 600);
}

// ── Inicializar todo cuando el DOM esté listo ────────────────────
window.addEventListener('load', () => {
  initCanvas();
  loadStudioData();
});
