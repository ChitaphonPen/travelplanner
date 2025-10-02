// ========== DATA LAYER ==========
const STORAGE_KEY = "tripPlannerData_v1";

// โหลดจาก LocalStorage ถ้ามี ไม่งั้นอ่านจาก data/itinerary.json
async function loadItinerary() {
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) return JSON.parse(cached);

  const res = await fetch("data/itinerary.json");
  const json = await res.json();
  saveItinerary(json);
  return json;
}
function saveItinerary(data){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ========== RENDER ==========
let STATE = { raw: null, day: null, query: "", tagsActive: new Set() };

$(async function () {
  STATE.raw = await loadItinerary();
  initDayOptions();
  renderAll();
  bindEvents();
});

function initDayOptions(){
  const days = STATE.raw.days.map(d => d.date);
  const $dayFilter = $("#dayFilter");
  const $formDay = $("#formDay");
  $dayFilter.empty().append(`<option value="">ทั้งหมด (${days.length} วัน)</option>`);
  days.forEach((d,i)=>{
    const label = `${i+1}: ${d}`;
    $dayFilter.append(`<option value="${d}">Day ${label}</option>`);
    $formDay.append(`<option value="${d}">Day ${label}</option>`);
  });
}

function renderAll(){
  renderTags();
  renderItems();
  renderSummary();
}

function renderTags(){
  const tagSet = new Set();
  STATE.raw.days.forEach(d => d.items.forEach(it => (it.tags||[]).forEach(t => tagSet.add(t))));
  const $wrap = $("#tagChips").empty();
  [...tagSet].sort().forEach(tag=>{
    const active = STATE.tagsActive.has(tag) ? "active" : "";
    $wrap.append(`<button class="btn btn-outline-primary ${active}" data-tag="${tag}">#${tag}</button>`);
  });
}

function renderSummary(){
  const day = STATE.day;
  let items = getFilteredItems();
  const cost = items.reduce((sum, it)=> sum + (Number(it.cost)||0), 0);
  const msg = day ? `สรุป ${day}: กิจกรรม ${items.length} รายการ · งบรวม ~ ${cost.toLocaleString()} ฿`
                  : `ทุกวัน: กิจกรรม ${items.length} รายการ · งบรวม ~ ${cost.toLocaleString()} ฿`;
  $("#daySummary").text(msg);
}

function getFilteredItems(){
  const q = STATE.query.trim().toLowerCase();
  const tagFilterActive = STATE.tagsActive.size > 0;
  let list = [];

  STATE.raw.days.forEach(d=>{
    d.items.forEach(it=>{
      if (STATE.day && d.date !== STATE.day) return;

      const joined = [
        d.date, it.time, it.title, it.note, (it.tags||[]).join(",")
      ].join(" ").toLowerCase();
      if (q && !joined.includes(q)) return;
      if (tagFilterActive) {
        const tags = new Set(it.tags||[]);
        for (const t of STATE.tagsActive){ if(!tags.has(t)) return; }
      }

      list.push({
        ...it,
        __day: d.date,
        __bgcolor: d.bgcolor || null   // ✅ เก็บสีพื้นหลังไว้
      });
    });
  });

  return list.sort((a,b)=>{
    const ad = a.__day.localeCompare(b.__day);
    if (ad !== 0) return ad;
    return (a.time||"").localeCompare(b.time||"");
  });
}


function renderItems(){
  const items = getFilteredItems();
  const $root = $("#items").empty();

  if (items.length === 0){
    $root.append(`<div class="col-12 text-center text-muted py-5">ไม่พบกิจกรรม</div>`);
    return;
  }

  items.forEach((it)=>{
  // รองรับข้อมูลเก่า: แปลง image -> images
  const imgs = (it.images && it.images.length) ? it.images
              : (it.image ? [it.image] : []);

  let mediaHtml = "";
  if (imgs.length > 1) {
    const cid = "car_" + it.id; // unique id ต่อการ์ด
    const slides = imgs.map((url,idx)=>`
      <div class="carousel-item ${idx===0?'active':''}">
        <img loading="lazy" src="${url}" class="card-img-fixed" alt="${escapeHtml(it.title)} ${idx+1}">
      </div>
    `).join("");

    mediaHtml = `
      <div id="${cid}" class="carousel slide" data-bs-ride="false">
        <div class="carousel-inner">
          ${slides}
        </div>
        <button class="carousel-control-prev" type="button" data-bs-target="#${cid}" data-bs-slide="prev">
          <span class="carousel-control-prev-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Previous</span>
        </button>
        <button class="carousel-control-next" type="button" data-bs-target="#${cid}" data-bs-slide="next">
          <span class="carousel-control-next-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Next</span>
        </button>
        <div class="carousel-indicators">
          ${imgs.map((_,i)=>`<button type="button" data-bs-target="#${cid}" data-bs-slide-to="${i}" class="${i===0?'active':''}" aria-label="Slide ${i+1}"></button>`).join("")}
        </div>
      </div>`;
  } else if (imgs.length === 1) {
    mediaHtml = `<img loading="lazy" src="${imgs[0]}" class="card-img-fixed" alt="${escapeHtml(it.title)}">`;
  }

  const linkSite = it.link ? `<a href="${it.link}" target="_blank" class="btn btn-outline-primary btn-sm me-2">
                                <i class="bi bi-link-45deg"></i> เว็บไซต์
                              </a>` : "";
  const linkMap = it.map ? `<a href="${it.map}" target="_blank" class="btn btn-outline-success btn-sm">
                              <i class="bi bi-geo-alt"></i> แผนที่
                            </a>` : "";
  const tags = (it.tags||[]).map(t=>`<span class="badge rounded-pill badge-tag me-1">#${t}</span>`).join("");
  const cost = it.cost ? `<span class="text-nowrap"><i class="bi bi-cash-coin"></i> ${Number(it.cost).toLocaleString()} ฿</span>` : "";
  const time = it.time ? `<span class="time me-2"><i class="bi bi-clock"></i> ${it.time}</span>` : "";
  const cardStyle = it.__bgcolor ? `style="background-color:${it.__bgcolor}"` : "";

  $("#items").append(`
    <div class="col-md-6 col-lg-4">
      <div class="card card-trip h-100" ${cardStyle}>
        ${mediaHtml}
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <div class="small text-muted mb-1"><i class="bi bi-calendar2-week"></i> ${it.__day}</div>
              <h5 class="card-title mb-1">${escapeHtml(it.title)}</h5>
            </div>
            <button class="btn btn-sm btn-outline-secondary rounded-circle btn-edit" data-id="${it.id}">
              <i class="bi bi-pencil"></i>
            </button>
          </div>
          <div class="mb-2">
            ${time} ${cost}
          </div>
          <p class="card-text flex-grow-1">${escapeHtml(it.note||"")}</p>
          <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
            <div class="tags">${tags}</div>
            <div>${linkSite}${linkMap}</div>
          </div>
        </div>
      </div>
    </div>
  `);
});
}


// ========== EVENTS ==========
function bindEvents(){
  $("#searchBox").on("input", function(){
    STATE.query = $(this).val();
    renderAll();
  });
  $("#dayFilter").on("change", function(){
    STATE.day = $(this).val() || null;
    renderAll();
  });
  $("#tagChips").on("click", ".btn", function(){
    const t = $(this).data("tag");
    if (STATE.tagsActive.has(t)) STATE.tagsActive.delete(t);
    else STATE.tagsActive.add(t);
    renderAll();
  });

  // Edit
  $("#items").on("click", ".btn-edit", function(){
    const id = $(this).data("id");
    openEdit(id);
  });

  // Modal form submit
  $("#itemForm").on("submit", function(e){
    e.preventDefault();
    const payload = {
  id: $("#itemId").val() || genId(),
  day: $("#formDay").val(),
  time: $("#formTime").val(),
  title: $("#formTitle").val().trim(),
  image: $("#formImage").val().trim(),
  link: $("#formLink").val().trim(),
  map: $("#formMap").val().trim(),
  note: $("#formNote").val().trim(),
  cost: Number($("#formCost").val()||0),
  tags: splitTags($("#formTags").val())
};

    upsertItem(payload);
    bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
    renderAll();
  });

  // Delete
  $("#btnDelete").on("click", function(){
    const id = $("#itemId").val();
    if (!id) return;
    removeItem(id);
    bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
    renderAll();
  });

  // Import/Export JSON
  $("#btnExport").on("click", exportJSON);
  $("#btnImport").on("click", ()=>$("#fileInput").click());
  $("#fileInput").on("change", async function(){
    const file = this.files[0];
    if (!file) return;
    const text = await file.text();
    const json = JSON.parse(text);
    saveItinerary(json);
    STATE.raw = json;
    STATE.day = null;
    STATE.query = "";
    STATE.tagsActive = new Set();
    initDayOptions();
    renderAll();
    this.value = "";
  });

  // When opening modal without id = create
  $('#editModal').on('show.bs.modal', function (e) {
    if (!$("#itemId").val()){
      // default day = current filter or first day
      const d = STATE.day || STATE.raw.days[0].date;
      $("#formDay").val(d);
      $("#btnDelete").addClass("d-none");
      $("#itemForm")[0].reset();
      $("#formDay").val(d);
    }
  });
}

function openEdit(id){
  const {item, day} = findItemById(id);
  $("#itemId").val(item.id);
  $("#formDay").val(day.date);
  $("#formTime").val(item.time||"");
  $("#formTitle").val(item.title||"");
  $("#formImage").val(item.image||"");
  $("#formLink").val(item.link||"");
$("#formMap").val(item.map||"");
  $("#formNote").val(item.note||"");
  $("#formCost").val(item.cost||"");
  $("#formTags").val((item.tags||[]).join(", "));
  $("#btnDelete").removeClass("d-none");
  new bootstrap.Modal(document.getElementById('editModal')).show();
}

// CRUD helpers
function upsertItem(payload){
  // move into target day
  let day = STATE.raw.days.find(d=>d.date===payload.day);
  if (!day){
    day = { date: payload.day, items: [] };
    STATE.raw.days.push(day);
  }
  // if exists: update; else push
  const {item, day: oldDay} = findItemById(payload.id) || {};
  const newItem = {
  id: payload.id,
  time: payload.time,
  title: payload.title,
  images: payload.images,
  link: payload.link,
  map: payload.map,
  note: payload.note,
  cost: payload.cost,
  tags: payload.tags
};

  if (item){
    // remove from old day if moved
    oldDay.items = oldDay.items.filter(x=>x.id!==payload.id);
  }
  day.items.push(newItem);
  saveItinerary(STATE.raw);
}

function removeItem(id){
  for (const d of STATE.raw.days){
    const before = d.items.length;
    d.items = d.items.filter(it=>it.id!==id);
    if (d.items.length !== before) break;
  }
  saveItinerary(STATE.raw);
}

function findItemById(id){
  for (const d of STATE.raw.days){
    for (const it of d.items){
      if (it.id===id) return { item: it, day: d };
    }
  }
  return null;
}

// Utils
function genId(){ return "it_" + Math.random().toString(36).slice(2,8); }
function splitTags(str){ return (str||"").split(",").map(s=>s.trim()).filter(Boolean); }
function escapeHtml(s){ return (s||"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;" }[m])); }

// Export as downloadable file
function exportJSON(){
  const blob = new Blob([JSON.stringify(STATE.raw, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "itinerary.json";
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}


// helper แยก url ด้วย comma
function splitUrls(str){ return (str||"").split(",").map(s=>s.trim()).filter(Boolean); }

// ...ใน $("#itemForm").on("submit", ...)
const payload = {
  id: $("#itemId").val() || genId(),
  day: $("#formDay").val(),
  time: $("#formTime").val(),
  title: $("#formTitle").val().trim(),
  // NEW:
  images: splitUrls($("#formImages").val()),
  link: $("#formLink").val().trim(),
  map: $("#formMap").val().trim(),
  note: $("#formNote").val().trim(),
  cost: Number($("#formCost").val()||0),
  tags: splitTags($("#formTags").val())
};

// ...ใน openEdit(id)
$("#formImages").val(((item.images && item.images.length) ? item.images : (item.image ? [item.image] : [] )).join(", "));
