    class StopMonitoringApp {
      constructor() {
        this.users = this.load('tc_users', INITIAL_USERS);
        this.stops = this.load('tc_stops', INITIAL_STOPS);
        this.tickets = this.load('tc_tickets', INITIAL_TICKETS);
        this.inspections = this.load('tc_inspections', INITIAL_INSPECTIONS);
        this.currentUser = this.load('tc_curr_user', null);

        this.map = null;
        this.markers = {};
        this.currentCity = "Великий Новгород";
        this.selectedStopId = null;
        this.charts = {};

        this.stopCardTab = 'passport';
        this.stopCardTabStopId = null;

        this.reportPhotoData = null;
        this.inspPhotoData = null;

        this.modalMap = null;
        this.modalMarker = null;
      }

      load(key, fallback) { return JSON.parse(JSON.stringify(fallback)); }

      async api(path, opts = {}) {
        const r = await fetch('/api/' + path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
        let j = {}; try { j = await r.json(); } catch (e) {}
        if (!r.ok) throw new Error(j.error || 'Ошибка сервера (' + r.status + ')');
        return j;
      }

      async loadData() {
        const d = await this.api('data');
        this.notifications = d.notifications || []; this.users = d.users; this.stops = d.stops; this.tickets = d.tickets; this.inspections = d.inspections;
      }

      async changeUser(id, patch) {
        try {
          await this.api('data', { method: 'PATCH', body: { id, ...patch } });
          Object.assign(this.users.find(u => u.id === id) || {}, patch);
          this.renderUsersTable();
          this.showToast('Учётная запись обновлена', 'success');
        } catch (e) { this.showToast(e.message, 'warning'); }
      }

      startSync() {
        clearInterval(this._sync);
        this._sync = setInterval(async () => {
          if (document.hidden || !this.currentUser || this._dirty) return;
          if (document.querySelector('.modal-backdrop:not(.hidden), #auth-screen:not(.hidden)')) return;
          try { await this.loadData(); this.renderAllViews(); this.renderBell(); } catch (e) {}
        }, 20000);
      }

      persist(key, data) {
        const k = key.replace('tc_', '');
        if (!['stops', 'tickets', 'inspections'].includes(k)) return true;
        this._t = this._t || {};
        clearTimeout(this._t[k]);
        this._dirty = true;
        this._t[k] = setTimeout(() => this.api('data?key=' + k, { method: 'PUT', body: data })
          .then(r => { if (r.data) this[k] = r.data; })
          .catch(async e => { this.showToast(e.message, 'warning'); try { await this.loadData(); this.renderAllViews(); this.renderBell(); } catch (x) {} })
          .finally(() => { this._dirty = false; }), 400);
        return true;
      }

      async init() {
        if (this._initialized) return;
        this._initialized = true;
        try { this.populateQuickCities(); this.setupAutocompleteListeners(); } catch (e) { console.warn('Init warning:', e); }
        try {
          const me = await this.api('auth?action=me');
          this.currentUser = me.user;
          await this.loadData();
          this.hideAuth();
          this.applyUserRoleUI();
          this.startSync();
        } catch (e) { this.currentUser = null; this.showAuth(); }
      }

      populateQuickCities() {
        const select = document.getElementById('map-quick-cities');
        if (!select) return;

        const groups = {
          "Северо-Запад": ["Великий Новгород", "Санкт-Петербург", "Псков", "Вологда", "Череповец", "Калининград", "Мурманск", "Архангельск", "Петрозаводск", "Сыктывкар"],
          "Центральная Россия": ["Москва", "Тверь", "Ярославль", "Кострома", "Иваново", "Владимир", "Рязань", "Тула", "Калуга", "Смоленск", "Воронеж", "Белгород"],
          "Сибирь": ["Новосибирск", "Омск", "Красноярск", "Томск", "Кемерово", "Барнаул", "Иркутск"],
          "Урал": ["Екатеринбург", "Челябинск", "Тюмень", "Сургут", "Курган"],
          "Поволжье": ["Казань", "Нижний Новгород", "Самара", "Тольятти", "Уфа", "Пермь", "Саратов", "Оренбург", "Ижевск", "Ульяновск"],
          "Юг и Кавказ": ["Ростов-на-Дону", "Краснодар", "Сочи", "Волгоград", "Астрахань", "Севастополь", "Симферополь", "Ставрополь", "Махачкала"],
          "Дальний Восток": ["Владивосток", "Хабаровск", "Якутск", "Благовещенск", "Петропавловск-Камчатский", "Южно-Сахалинск"]
        };

        let html = `<option value="all">Все города РФ</option>`;
        for (const [groupName, cityNames] of Object.entries(groups)) {
          html += `<optgroup label="${groupName}">`;
          cityNames.forEach(cName => {
            const isSel = cName === this.currentCity ? 'selected' : '';
            html += `<option value="${cName}" ${isSel}>${cName}</option>`;
          });
          html += `</optgroup>`;
        }
        select.innerHTML = html;
      }

      searchLocation(query) {
        if (!query || query.trim().length === 0) return [];
        const normalized = query.trim().toLowerCase().replace(/ё/g, 'е');

        const scoredMatches = RUSSIAN_CITIES_CATALOG.map(c => {
          const cName = c.name.toLowerCase().replace(/ё/g, 'е');
          const cRegion = c.region.toLowerCase().replace(/ё/g, 'е');
          let score = 0;

          if (cName === normalized) score += 100;
          else if (cName.startsWith(normalized)) score += 80;
          else if (cName.includes(normalized)) score += 60;
          else if (cRegion.includes(normalized)) score += 40;

          const matchedDistrict = c.districts.find(d => d.toLowerCase().replace(/ё/g, 'е').includes(normalized));
          if (matchedDistrict) score += 30;

          return { name: c.name, region: c.region, district: matchedDistrict || c.districts[0] || 'Центральный район', lat: c.lat, lng: c.lng, score: score, source: 'База городов РФ' };
        }).filter(item => item.score > 0);

        scoredMatches.sort((a, b) => b.score - a.score);
        return scoredMatches.slice(0, 10);
      }

      setupAutocompleteListeners() {
        const mapSearch = document.getElementById('map-city-search');
        const mapResults = document.getElementById('map-city-results');

        if (mapSearch && mapResults) {
          mapSearch.addEventListener('input', (e) => {
            const val = e.target.value;
            if (!val || val.trim().length === 0) { mapResults.classList.add('hidden'); return; }
            const results = this.searchLocation(val);
            this.renderAutocompleteDropdown(mapResults, results, (item) => {
              mapSearch.value = item.name;
              this.jumpToCity(item.name, [item.lat, item.lng]);
            });
          });
        }

        const regSearch = document.getElementById('reg-city-search');
        const regResults = document.getElementById('reg-city-results');

        if (regSearch && regResults) {
          regSearch.addEventListener('input', (e) => {
            const val = e.target.value;
            if (!val || val.trim().length === 0) { regResults.classList.add('hidden'); return; }
            const results = this.searchLocation(val);
            this.renderAutocompleteDropdown(regResults, results, (item) => {
              regSearch.value = item.name;
              const hidden = document.getElementById('reg-city-val');
              if (hidden) hidden.value = item.name;
              const districtInput = document.getElementById('reg-district');
              if (districtInput && item.district) districtInput.value = item.district;
            });
          });
        }

        document.addEventListener('click', (e) => {
          if (!e.target.closest('#map-city-search') && !e.target.closest('#map-city-results')) {
            document.getElementById('map-city-results')?.classList.add('hidden');
          }
          if (!e.target.closest('#reg-city-search') && !e.target.closest('#reg-city-results')) {
            document.getElementById('reg-city-results')?.classList.add('hidden');
          }
          if (!e.target.closest('#modal-geocode-query') && !e.target.closest('#modal-geocode-results')) {
            document.getElementById('modal-geocode-results')?.classList.add('hidden');
          }
        });
      }

      renderAutocompleteDropdown(container, items, onSelect) {
        if (!container) return;
        if (items.length === 0) {
          container.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center font-medium">Ничего не найдено в РФ</div>`;
          container.classList.remove('hidden');
          return;
        }

        container.innerHTML = items.map(item => `
          <div class="autocomplete-item p-2.5 hover:bg-indigo-50/90 cursor-pointer border-b border-slate-100 last:border-0 transition-colors flex items-center justify-between text-xs">
            <div>
              <div class="font-bold text-slate-800 flex items-center gap-1.5">
                <i class="fa-solid fa-location-dot text-indigo-500 text-[10px]"></i>
                <span class="text-indigo-950 font-bold">${item.name}</span>
                ${item.district ? `<span class="text-[10px] text-slate-500 font-normal">(${item.district})</span>` : ''}
              </div>
              <div class="text-[10px] text-slate-400 mt-0.5">${item.region}</div>
            </div>
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">${item.source}</span>
          </div>
        `).join('');

        container.querySelectorAll('.autocomplete-item').forEach((el, idx) => {
          el.addEventListener('click', () => {
            onSelect(items[idx]);
            container.classList.add('hidden');
          });
        });

        container.classList.remove('hidden');
      }

      searchModalAddress() {
        const query = document.getElementById('modal-geocode-query')?.value;
        const container = document.getElementById('modal-geocode-results');
        if (!query || query.trim().length === 0) {
          this.showToast('Введите название города или адреса для поиска', 'warning');
          return;
        }

        const results = this.searchLocation(query);
        this.renderAutocompleteDropdown(container, results, (item) => {
          const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
          setVal('modal-stop-city', item.name);
          setVal('modal-stop-district', item.district || item.region);
          setVal('modal-stop-name', `Остановка «${item.name}»`);
          this.setModalMapPoint(item.lat, item.lng, true);
          this.showToast(`Координаты ${item.name} установлены на карте`, 'success');
        });
      }

      jumpToCity(cityName, coords) {
        this.currentCity = cityName;
        const badge = document.getElementById('map-active-city-badge');
        if (badge) badge.textContent = cityName;

        const quickSelect = document.getElementById('map-quick-cities');
        if (quickSelect) quickSelect.value = cityName;

        if (this.map && coords && Array.isArray(coords) && coords.length === 2) {
          try { this.map.flyTo(coords, 13, { duration: 1.2 }); } catch (e) { console.warn(e); }
        }

        const stopsInCity = this.stops.filter(s => s.city.toLowerCase() === cityName.toLowerCase());
        const countBadge = document.getElementById('map-active-city-count');
        if (countBadge) countBadge.textContent = `(${stopsInCity.length} ост.)`;

        this.renderMapMarkers();

        if (stopsInCity.length === 0) {
          this.showToast(`Город ${cityName} загружен. Пока нет зарегистрированных остановок.`, 'info');
        } else {
          this.showToast(`Переход: ${cityName} (${stopsInCity.length} комплексов)`, 'success');
        }
      }

      handleQuickCityChange() {
        const selected = document.getElementById('map-quick-cities')?.value;
        if (selected === 'all') {
          this.currentCity = "Все города";
          const badge = document.getElementById('map-active-city-badge');
          if (badge) badge.textContent = "Все города РФ";
          const countBadge = document.getElementById('map-active-city-count');
          if (countBadge) countBadge.textContent = `(${this.stops.length} ост.)`;
          if (this.map) { try { this.map.flyTo([58.5228, 31.2698], 5); } catch(e){} }
          this.renderMapMarkers();
          return;
        }

        const cityObj = RUSSIAN_CITIES_CATALOG.find(c => c.name === selected);
        if (cityObj) this.jumpToCity(cityObj.name, [cityObj.lat, cityObj.lng]);
      }

      showAuth() { document.getElementById('auth-screen')?.classList.remove('hidden'); }
      hideAuth() { document.getElementById('auth-screen')?.classList.add('hidden'); }

      setAuthTab(tab) {
        const isLogin = tab === 'login';
        document.getElementById('auth-form-login')?.classList.toggle('hidden', !isLogin);
        document.getElementById('auth-form-register')?.classList.toggle('hidden', isLogin);

        const btnLogin = document.getElementById('tab-btn-login');
        const btnReg = document.getElementById('tab-btn-register');

        if (btnLogin) {
          btnLogin.className = isLogin
            ? 'flex-1 pb-3 text-xs sm:text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 transition-colors'
            : 'flex-1 pb-3 text-xs sm:text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition-colors';
        }
        if (btnReg) {
          btnReg.className = !isLogin
            ? 'flex-1 pb-3 text-xs sm:text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 transition-colors'
            : 'flex-1 pb-3 text-xs sm:text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition-colors';
        }
      }

      async authRequest(action, body) {
        try {
          const r = await this.api('auth?action=' + action, { method: 'POST', body });
          this.currentUser = r.user;
          await this.loadData();
          this.hideAuth();
          this.applyUserRoleUI();
          this.startSync();
          return r.user;
        } catch (e) { this.showToast(e.message, 'warning'); }
      }

      demoLogin(role) {
        const m = { admin: 'alexeev@transcontrol.gov', dispatcher: 'kovaleva@transcontrol.gov', inspector: 'smirnov@transcontrol.gov', citizen: 'ivanov@mail.ru' };
        this.authRequest('login', { email: m[role], password: 'demo1234' }).then(u => u && this.showToast(`Авторизован: ${u.name}`, 'success'));
      }

      loginWithCredentials() {
        const email = document.getElementById('login-email')?.value.trim();
        const password = document.getElementById('login-password')?.value;
        this.authRequest('login', { email, password }).then(u => u && this.showToast(`Добро пожаловать, ${u.name}!`, 'info'));
      }

      registerCitizen(e) {
        e.preventDefault();
        const v = id => document.getElementById(id)?.value.trim();
        const pass = document.getElementById('reg-pass')?.value;
        if (pass !== document.getElementById('reg-pass-repeat')?.value) return this.showToast('Введенные пароли не совпадают!', 'warning');
        const city = v('reg-city-val') || 'Великий Новгород', district = v('reg-district') || 'Софийская сторона';
        this.authRequest('register', { name: v('reg-name'), email: v('reg-email'), phone: v('reg-phone'), city, district, password: pass })
          .then(u => u && this.showToast(`Регистрация жителя (${city}, ${district}) успешна!`, 'success'));
      }

      async logout() {
        try { await this.api('auth?action=logout', { method: 'POST' }); } catch (e) {}
        this.currentUser = null;
        clearInterval(this._sync);
        if (this.map) { try { this.map.remove(); } catch (err) {} this.map = null; }
        if (this.modalMap) { try { this.modalMap.remove(); } catch (err) {} this.modalMap = null; this.modalMarker = null; }
        const mapContainer = document.getElementById('city-map');
        if (mapContainer) mapContainer._leaflet_id = null;
        this.showAuth();
        this.showToast('Вы вышли из системы.', 'info');
      }

      applyUserRoleUI() {
        if (!this.currentUser) return;

        const initials = this.currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('');
        const avatarEl = document.getElementById('header-avatar');
        const nameEl = document.getElementById('header-user-name');
        const locEl = document.getElementById('header-user-location');
        const badgeEl = document.getElementById('header-user-badge');

        if (avatarEl) avatarEl.textContent = initials;
        if (nameEl) nameEl.textContent = this.currentUser.name;
        if (locEl) locEl.textContent = `${this.currentUser.city || 'Великий Новгород'} • ${this.currentUser.district || 'Район'}`;

        const roleBadges = {
          admin: { text: 'Администратор', bg: 'bg-rose-100 text-rose-800 border-rose-200' },
          dispatcher: { text: 'Диспетчер', bg: 'bg-amber-100 text-amber-800 border-amber-200' },
          inspector: { text: 'Инспектор', bg: 'bg-blue-100 text-blue-800 border-blue-200' },
          citizen: { text: 'Житель города', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
        };

        const badge = roleBadges[this.currentUser.role] || { text: 'Пользователь', bg: 'bg-slate-100 text-slate-800 border-slate-200' };
        if (badgeEl) {
          badgeEl.textContent = badge.text;
          badgeEl.className = `ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}`;
        }

        const repCityDisp = document.getElementById('report-city-display');
        if (repCityDisp) {
          repCityDisp.value = `${this.currentUser.city || 'Великий Новгород'}`;
          this.updateReportStopsList();
        }

        this.generateNavTabs();

        if (this.currentUser.role === 'citizen') this.switchView('map');
        else if (this.currentUser.role === 'inspector') this.switchView('inspector');
        else if (this.currentUser.role === 'dispatcher') this.switchView('dispatcher');
        else this.switchView('map');

        this.renderAllViews();
        this.renderBell();
      }

      generateNavTabs() {
        const tabsContainer = document.getElementById('role-nav-tabs');
        if (!tabsContainer || !this.currentUser) return;
        const role = this.currentUser.role;

        let tabs = [];
        if (role === 'admin') {
          tabs = [
            { id: 'map', label: 'Карта остановок', icon: 'fa-map' },
            { id: 'registry', label: 'Реестр комплексов', icon: 'fa-list-check' },
            { id: 'dispatcher', label: 'Диспетчерская', icon: 'fa-headset' },
            { id: 'analytics', label: 'Аналитика и KPI', icon: 'fa-chart-pie' },
            { id: 'users', label: 'Пользователи', icon: 'fa-users-gear' }
          ];
        } else if (role === 'dispatcher') {
          tabs = [
            { id: 'dispatcher', label: 'Канбан заявок', icon: 'fa-headset' },
            { id: 'map', label: 'Карта сети', icon: 'fa-map' },
            { id: 'analytics', label: 'Аналитика и SLA', icon: 'fa-chart-pie' }
          ];
        } else if (role === 'inspector') {
          tabs = [
            { id: 'inspector', label: 'Чек-лист осмотра', icon: 'fa-clipboard-check' },
            { id: 'map', label: 'Карта объектов', icon: 'fa-map' }
          ];
        } else {
          tabs = [
            { id: 'map', label: 'Карта остановок', icon: 'fa-map' },
            { id: 'citizen-report', label: 'Сообщить о дефекте', icon: 'fa-circle-exclamation' },
            { id: 'citizen-tickets', label: 'Мои обращения', icon: 'fa-clock-rotate-left' }
          ];
        }

        tabsContainer.innerHTML = tabs.map((t, idx) => `
          <button onclick="app.switchView('${t.id}')" id="nav-btn-${t.id}" class="px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap flex items-center gap-2 transition-all ${idx === 0 ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'}">
            <i class="fa-solid ${t.icon}"></i> <span>${t.label}</span>
          </button>
        `).join('');
      }

      switchView(viewId) {
        const viewIds = ['map', 'registry', 'dispatcher', 'inspector', 'citizen-report', 'citizen-tickets', 'analytics', 'users'];
        viewIds.forEach(id => {
          const el = document.getElementById(`view-${id}`);
          if (el) el.classList.toggle('hidden', id !== viewId);

          const btn = document.getElementById(`nav-btn-${id}`);
          if (btn) {
            if (id === viewId) {
              btn.className = 'px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap flex items-center gap-2 transition-all bg-indigo-600 text-white shadow-sm';
            } else {
              btn.className = 'px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap flex items-center gap-2 transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-200/60';
            }
          }
        });

        if (viewId === 'map') {
          if (!this.map) {
            setTimeout(() => this.initMap(), 100);
          } else {
            setTimeout(() => { try { this.map.invalidateSize(); } catch(e){} }, 150);
          }
        }

        if (viewId === 'analytics') {
          setTimeout(() => this.renderAnalyticsCharts(), 150);
        }
      }

      initMap() {
        const mapContainer = document.getElementById('city-map');
        if (!mapContainer) return;

        if (this.map) { try { this.map.remove(); } catch(e) {} this.map = null; }
        if (mapContainer._leaflet_id) { delete mapContainer._leaflet_id; }
        mapContainer.innerHTML = '';

        const startCity = (this.currentUser && this.currentUser.city) ? this.currentUser.city : "Великий Новгород";
        const cityMatch = RUSSIAN_CITIES_CATALOG.find(c => c.name.toLowerCase() === startCity.toLowerCase());
        const coords = cityMatch ? [cityMatch.lat, cityMatch.lng] : [58.5228, 31.2698];

        try {
          // attributionControl: false — полностью убираем дефолтный префикс Leaflet с флагом
          this.map = L.map('city-map', { zoomControl: false, preferCanvas: true, attributionControl: false }).setView(coords, 13);
          L.control.zoom({ position: 'bottomright' }).addTo(this.map);

          // Своя компактная атрибуция без логотипа Leaflet
          L.control.attribution({ position: 'bottomright', prefix: false }).addTo(this.map);

          const esriStreet = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; Esri, HERE, Garmin, OpenStreetMap', maxZoom: 19
          }).addTo(this.map);

          const esriTopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; Esri &mdash; Topo'
          });

          L.control.layers({
            "Схема улиц": esriStreet,
            "Топографическая": esriTopo
          }, null, { position: 'topright' }).addTo(this.map);
        } catch (e) {
          console.warn('Leaflet init error:', e);
          return;
        }

        this.renderMapMarkers();
      }

      renderMapMarkers() {
        if (!this.map) return;

        Object.values(this.markers).forEach(m => { try { m.remove(); } catch(e){} });
        this.markers = {};

        const statusFilter = document.getElementById('map-filter-status')?.value || 'all';

        const filtered = this.stops.filter(s => {
          if (this.currentCity && this.currentCity !== "Все города") {
            if (s.city.toLowerCase() !== this.currentCity.toLowerCase()) return false;
          }
          if (statusFilter !== 'all' && s.status !== statusFilter) return false;
          return true;
        });

        filtered.forEach(stop => {
          const colorClass = stop.status === 'good'
            ? 'bg-emerald-500 text-white'
            : (stop.status === 'warning' ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white pulse-danger-marker');

          const icon = L.divIcon({
            className: 'custom-leaflet-pin',
            html: `<div class="w-8 h-8 rounded-full ${colorClass} flex items-center justify-center shadow-lg border-2 border-white font-bold text-xs cursor-pointer"><i class="fa-solid fa-bus"></i></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          const marker = L.marker([stop.lat, stop.lng], { icon }).addTo(this.map);
          marker.on('click', () => this.selectStop(stop.id));
          this.markers[stop.id] = marker;
        });

        if (this.selectedStopId && this.stops.find(s => s.id === this.selectedStopId)) {
          this.renderStopDetails(this.selectedStopId);
        } else if (filtered.length > 0) {
          this.selectStop(filtered[0].id);
        } else {
          this.renderEmptyStopCard();
        }
      }

      selectStop(stopId) {
        this.selectedStopId = stopId;
        this.renderStopDetails(stopId);
      }

      showOnMap(stopId) {
        const stop = this.stops.find(s => s.id === stopId);
        if (!stop) { this.showToast('Объект не найден в реестре', 'warning'); return; }

        this.currentCity = stop.city;
        const badge = document.getElementById('map-active-city-badge');
        if (badge) badge.textContent = stop.city;

        const quickSelect = document.getElementById('map-quick-cities');
        if (quickSelect) quickSelect.value = stop.city;

        const stopsInCity = this.stops.filter(s => s.city.toLowerCase() === stop.city.toLowerCase());
        const countBadge = document.getElementById('map-active-city-count');
        if (countBadge) countBadge.textContent = `(${stopsInCity.length} ост.)`;

        this.selectedStopId = stop.id;
        this.stopCardTab = 'passport';
        this.stopCardTabStopId = stop.id;

        this.switchView('map');

        setTimeout(() => {
          if (this.map) { try { this.map.flyTo([stop.lat, stop.lng], 16, { duration: 1.0 }); } catch(e){} }
          this.renderMapMarkers();
          this.renderStopDetails(stop.id);
        }, 400);
      }

      renderEmptyStopCard() {
        const card = document.getElementById('stop-details-card');
        if (!card) return;
        const isAdmin = this.currentUser && this.currentUser.role === 'admin';
        card.innerHTML = `
          <div class="text-center py-20 text-slate-400 my-auto">
            <i class="fa-solid fa-city text-4xl mb-3 text-slate-300"></i>
            <h4 class="font-bold text-slate-700 text-sm">В городе «${this.currentCity}» пока нет остановок</h4>
            <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Добавьте первый остановочный комплекс с выбором точки на карте.</p>
            ${isAdmin ? `<button onclick="app.openStopModal('${this.currentCity}')" class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 transition-colors"><i class="fa-solid fa-plus mr-1"></i> Добавить комплекс в ${this.currentCity}</button>` : ''}
          </div>
        `;
      }

      switchStopTab(tab) {
        this.stopCardTab = tab;
        if (this.selectedStopId) this.renderStopDetails(this.selectedStopId);
      }

      renderStopDetails(stopId) {
        const stop = this.stops.find(s => s.id === stopId);
        const card = document.getElementById('stop-details-card');
        if (!stop || !card) return;

        if (this.stopCardTabStopId !== stopId) {
          this.stopCardTab = 'passport';
          this.stopCardTabStopId = stopId;
        }
        if (!this.stopCardTab) this.stopCardTab = 'passport';

        const statusBadges = {
          good: '<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">🟢 Исправно</span>',
          warning: '<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">🟡 Требует внимания</span>',
          danger: '<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 animate-pulse">🔴 Аварийное</span>'
        };

        const activeStopTickets = this.tickets.filter(t => t.stopId === stop.id && t.status !== 'done');
        const allStopTickets = this.tickets.filter(t => t.stopId === stop.id);
        const inspections = this.inspections.filter(i => i.stopId === stop.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const tabBtn = (id, label, count) => {
          const active = this.stopCardTab === id;
          return `<button onclick="app.switchStopTab('${id}')" class="px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}">${label}${count !== null ? ` <span class="${active ? 'text-indigo-100' : 'text-slate-400'}">(${count})</span>` : ''}</button>`;
        };

        const tabsHtml = `
          <div class="flex items-center gap-1 p-1 bg-slate-100 rounded-xl mb-3 sticky top-0 z-10">
            ${tabBtn('passport', 'Паспорт', null)}
            ${tabBtn('inspections', 'Акты осмотров', inspections.length)}
            ${tabBtn('tickets', 'Наряды', allStopTickets.length)}
          </div>
        `;

        let bodyHtml = '';

        if (this.stopCardTab === 'passport') {
          bodyHtml = `
            <div class="relative rounded-2xl overflow-hidden mb-3 border border-slate-200 shadow-sm">
              <img src="${stop.photo}" alt="${stop.name}" class="w-full h-36 object-cover" onerror="this.style.display='none'">
              <div class="absolute top-2 right-2">${statusBadges[stop.status]}</div>
              <div class="absolute bottom-2 left-2 bg-slate-900/85 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm">${stop.city} • ${stop.district}</div>
            </div>
            <h3 class="text-base font-bold text-slate-900 leading-snug">${stop.name}</h3>
            <p class="text-xs text-slate-500 mt-0.5"><i class="fa-solid fa-location-crosshairs text-indigo-500 mr-1"></i> Координаты: ${Number(stop.lat).toFixed(4)}, ${Number(stop.lng).toFixed(4)}</p>
            ${stop.installedDate ? `<p class="text-[11px] text-slate-400 mt-0.5"><i class="fa-solid fa-calendar-check mr-1"></i> Дата установки: ${stop.installedDate}</p>` : ''}
            <div class="mt-3 py-2 border-y border-slate-100 text-xs">
              <div class="font-bold text-slate-700 mb-1">Маршруты городского транспорта:</div>
              <div class="text-slate-600 font-medium">${stop.routes}</div>
            </div>
            <div class="mt-3 text-xs">
              <div class="font-bold text-slate-700 mb-1.5">Установленное оборудование:</div>
              <div class="flex flex-wrap gap-1">${(stop.equipment || []).map(e => `<span class="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-semibold"><i class="fa-solid fa-check text-emerald-600 mr-1"></i>${e}</span>`).join('')}</div>
            </div>
            <div class="mt-4 pt-3 border-t border-slate-100">
              <div class="flex items-center justify-between mb-2"><span class="text-xs font-bold text-slate-800">Активные наряды (${activeStopTickets.length})</span></div>
              ${activeStopTickets.length === 0 ? '<p class="text-[11px] text-slate-400">Активных дефектов не зафиксировано</p>' : `<div class="space-y-1.5">${activeStopTickets.map(t => `<div class="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px]"><div class="font-bold text-slate-800">${t.category}</div><div class="text-[10px] text-slate-500 mt-0.5">SLA: ${t.sla} • Подрядчик: ${t.contractor}</div></div>`).join('')}</div>`}
            </div>
          `;
        } else if (this.stopCardTab === 'inspections') {
          if (inspections.length === 0) {
            bodyHtml = `<div class="text-center py-12 text-slate-400"><i class="fa-solid fa-clipboard-list text-3xl mb-2 text-slate-300"></i><p class="text-xs font-semibold">Актов осмотров по объекту пока нет</p></div>`;
          } else {
            const resBadge = (r) => r === 'danger' ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Аварийно</span>' : (r === 'warning' ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Внимание</span>' : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Норма</span>');
            bodyHtml = inspections.map(i => `
              <div class="p-3 rounded-xl border border-slate-200 bg-white mb-2.5">
                <div class="flex items-center justify-between"><span class="text-[11px] font-mono font-bold text-indigo-600">${i.id}</span>${resBadge(i.result)}</div>
                <div class="text-xs font-bold text-slate-800 mt-1"><i class="fa-solid fa-user-shield text-slate-400 mr-1"></i>${i.inspector}</div>
                <div class="text-[10px] text-slate-500 mt-0.5"><i class="fa-regular fa-clock mr-1"></i>${i.date}</div>
                ${i.notes ? `<p class="text-[11px] text-slate-600 bg-slate-50 rounded-lg p-2 mt-2 border border-slate-100">${i.notes}</p>` : ''}
                ${i.photo ? `<img src="${i.photo}" class="w-full h-28 object-cover rounded-lg mt-2 border border-slate-200" alt="Фото акта">` : ''}
                <details class="mt-2">
                  <summary class="text-[10px] font-bold text-indigo-600 cursor-pointer select-none">Показать 8 пунктов чек-листа</summary>
                  <div class="mt-1.5 space-y-1">${(i.results || []).map(r => { const icon = r.value === 'ok' ? '<i class="fa-solid fa-circle-check text-emerald-500"></i>' : (r.value === 'warning' ? '<i class="fa-solid fa-triangle-exclamation text-amber-500"></i>' : '<i class="fa-solid fa-circle-xmark text-rose-500"></i>'); return `<div class="flex items-center justify-between text-[10px] text-slate-600 px-1.5 py-1 rounded hover:bg-slate-50">${icon}<span class="flex-1 ml-1.5">${r.item}</span></div>`; }).join('')}</div>
                </details>
              </div>
            `).join('');
          }
        } else {
          if (allStopTickets.length === 0) {
            bodyHtml = `<div class="text-center py-12 text-slate-400"><i class="fa-solid fa-screwdriver-wrench text-3xl mb-2 text-slate-300"></i><p class="text-xs font-semibold">Нарядов по объекту не зарегистрировано</p></div>`;
          } else {
            const stBadge = { new: '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Принята</span>', in_progress: '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">В работе</span>', review: '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">На приемке</span>', done: '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Выполнена</span>' };
            bodyHtml = allStopTickets.map(t => `
              <div class="p-3 rounded-xl border border-slate-200 bg-white mb-2.5">
                <div class="flex items-center justify-between"><span class="text-[11px] font-mono font-bold text-indigo-600">${t.id}</span>${stBadge[t.status] || ''}</div>
                <div class="text-xs font-bold text-slate-800 mt-1">${t.category}</div>
                <p class="text-[11px] text-slate-600 bg-slate-50 rounded-lg p-2 mt-1.5 border border-slate-100">${t.description}</p>
                ${t.photo ? `<img src="${t.photo}" class="w-full h-28 object-cover rounded-lg mt-2 border border-slate-200" alt="Фото дефекта">` : ''}
                <div class="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100"><span class="font-semibold text-slate-600">${t.contractor}</span><span>SLA: ${t.sla}</span></div>
              </div>
            `).join('');
          }
        }

        const actionHtml = `
          <div class="pt-4 border-t border-slate-100 mt-4 space-y-2">
            ${this.currentUser.role === 'citizen' ? `<button onclick="app.reportFromStopCard('${stop.id}')" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 transition-colors flex items-center justify-center space-x-2"><i class="fa-solid fa-bullhorn"></i><span>Сообщить о поломке на этой остановке</span></button>` : (this.currentUser.role === 'inspector' ? `<button onclick="app.startInspectionFor('${stop.id}')" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-200 transition-colors flex items-center justify-center space-x-2"><i class="fa-solid fa-clipboard-check"></i><span>Провести осмотр комплекса</span></button>` : `
              <div class="grid grid-cols-2 gap-2">
                <button onclick="app.editStop('${stop.id}')" class="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-colors flex items-center justify-center space-x-1.5"><i class="fa-solid fa-pen-to-square"></i><span>Редактировать</span></button>
                <button onclick="app.openStopModal('${stop.city}')" class="py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center space-x-1.5"><i class="fa-solid fa-plus"></i><span>Добавить</span></button>
              </div>
            `)}
          </div>
        `;

        card.innerHTML = tabsHtml + `<div>${bodyHtml}</div>` + actionHtml;
      }

      reportFromStopCard(stopId) {
        const stop = this.stops.find(s => s.id === stopId);
        if (!stop) return;
        this.switchView('citizen-report');
        const repCity = document.getElementById('report-city-display');
        if (repCity) repCity.value = stop.city;
        this.updateReportStopsList(stop.city);
        const repStop = document.getElementById('report-stop');
        if (repStop) repStop.value = stop.id;
      }

      startInspectionFor(stopId) {
        this.switchView('inspector');
        this.selectInspectorStop(stopId);
      }

      resetMapFilters() {
        this.currentCity = "Все города";
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        setVal('map-filter-status', 'all');
        setVal('map-city-search', '');
        setVal('map-quick-cities', 'all');

        const badge = document.getElementById('map-active-city-badge');
        if (badge) badge.textContent = "Все города РФ";
        const countBadge = document.getElementById('map-active-city-count');
        if (countBadge) countBadge.textContent = `(${this.stops.length} ост.)`;

        if (this.map) { try { this.map.flyTo([58.5228, 31.2698], 5); } catch(e){} }
        this.renderMapMarkers();
        this.showToast('Фильтры карты сброшены', 'info');
      }

      recalculateStopStatus(stopId) {
        const stop = this.stops.find(s => s.id === stopId);
        if (!stop) return;
        const active = this.tickets.filter(t => t.stopId === stopId && t.status !== 'done');
        if (active.some(t => t.severity === 'critical')) stop.status = 'danger';
        else if (active.length > 0) stop.status = 'warning';
        else stop.status = 'good';
        this.persist('tc_stops', this.stops);
      }

      renderDispatcherKanban() {
        const cols = { new: document.getElementById('kanban-col-new'), in_progress: document.getElementById('kanban-col-in_progress'), review: document.getElementById('kanban-col-review'), done: document.getElementById('kanban-col-done') };
        if (!cols.new) return;

        Object.values(cols).forEach(c => { if (c) c.innerHTML = ''; });
        const counts = { new: 0, in_progress: 0, review: 0, done: 0 };

        this.tickets.forEach(t => {
          if (counts[t.status] !== undefined) counts[t.status]++;
          const colEl = cols[t.status] || cols.new;
          if (!colEl) return;

          const severityBadges = {
            critical: '<span class="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">Критический (SLA 6ч)</span>',
            medium: '<span class="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Средний (SLA 24ч)</span>',
            low: '<span class="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">Низкий</span>'
          };

          const card = document.createElement('div');
          card.className = "bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2 hover:shadow-md transition-shadow";
          card.innerHTML = `
            <div class="flex items-center justify-between"><span class="text-[11px] font-mono font-bold text-indigo-600">${t.id}</span>${severityBadges[t.severity] || ''}</div>
            <div class="font-bold text-xs text-slate-900 leading-snug">${t.stopName}</div>
            <div class="text-[11px] text-slate-500 font-medium">${t.category} (${t.city}) ${this.isOverdue(t) ? '<span class="text-[10px] font-bold text-white bg-rose-600 px-1.5 py-0.5 rounded animate-pulse">Просрочено</span>' : ''}</div>${this.lastHist(t)}
            <p class="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">${t.description}</p>
            ${t.photo ? `<img src="${t.photo}" class="w-full h-24 object-cover rounded-lg border border-slate-200" alt="Фото дефекта">` : ''}
            <div class="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100"><span class="font-semibold text-slate-600">${t.contractor}</span><span>${(t.createdDate || '').split(' ')[0]}</span></div>
            <div class="pt-2 flex flex-wrap items-center justify-end gap-1.5">
              <button onclick="app.showOnMap('${t.stopId}')" class="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded-lg border border-indigo-200 transition-colors"><i class="fa-solid fa-map-location-dot mr-0.5"></i> На карте</button>
              ${t.status === 'new' ? `<button onclick="app.openDispatchModal('${t.id}')" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] rounded-lg shadow-sm transition-colors">Назначить подрядчика</button>` : (t.status === 'in_progress' ? `<button onclick="app.setTicketStatus('${t.id}', 'review')" class="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] rounded-lg">На проверку</button>` : (t.status === 'review' ? `<button onclick="app.setTicketStatus('${t.id}', 'done')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg">Закрыть (устранено)</button>` : '<span class="text-[10px] text-emerald-600 font-bold"><i class="fa-solid fa-check mr-1"></i> Завершено</span>'))}
            </div>
          `;
          colEl.appendChild(card);
        });

        const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setTxt('col-count-new', counts.new);
        setTxt('col-count-in_progress', counts.in_progress);
        setTxt('col-count-review', counts.review);
        setTxt('col-count-done', counts.done);
        setTxt('dispatcher-active-count', counts.new + counts.in_progress + counts.review);
      }

      openDispatchModal(ticketId) {
        const t = this.tickets.find(x => x.id === ticketId);
        if (!t) return;
        const idEl = document.getElementById('dispatch-ticket-id');
        const titleEl = document.getElementById('dispatch-ticket-title');
        if (idEl) idEl.value = ticketId;
        if (titleEl) titleEl.textContent = `${t.id}: ${t.stopName} — ${t.category}`;
        document.getElementById('modal-dispatch')?.classList.remove('hidden');
      }

      closeDispatchModal() { document.getElementById('modal-dispatch')?.classList.add('hidden'); }

      confirmDispatch() {
        const id = document.getElementById('dispatch-ticket-id')?.value;
        const contractor = document.getElementById('dispatch-contractor')?.value;
        const sla = document.getElementById('dispatch-sla')?.value;

        const ticket = this.tickets.find(t => t.id === id);
        if (ticket) {
          ticket.contractor = contractor;
          ticket.sla = sla;
          ticket.status = 'in_progress';
          this.persist('tc_tickets', this.tickets);
          this.recalculateStopStatus(ticket.stopId);
          this.closeDispatchModal();
          this.renderDispatcherKanban();
          this.renderMapMarkers();
          this.showToast(`Наряд ${ticket.id} направлен в ${contractor}`, 'success');
        }
      }

      setTicketStatus(ticketId, newStatus) {
        const ticket = this.tickets.find(t => t.id === ticketId);
        if (ticket) {
          ticket.status = newStatus;
          this.persist('tc_tickets', this.tickets);
          this.recalculateStopStatus(ticket.stopId);
          this.renderDispatcherKanban();
          this.renderMapMarkers();
          this.renderCitizenTickets();
          const statusLabels = { new: 'Принята', in_progress: 'В работе', review: 'На приёмке', done: 'Устранена' };
          this.showToast(`Статус наряда ${ticket.id}: ${statusLabels[newStatus] || newStatus}`, 'info');
        }
      }

      isAssigned(s) { const u = this.currentUser; return !u || u.role !== 'inspector' || !u.district || s.district === u.district; }

      isOverdue(t) {
        if (t.status === 'done') return false;
        const h = parseInt((String(t.sla).match(/\d+/) || [0])[0]), c = new Date(String(t.createdDate).replace(' ', 'T'));
        return !!h && !isNaN(c) && Date.now() > c.getTime() + h * 36e5;
      }

      lastHist(t) {
        const h = (t.history || []).slice(-1)[0], L = { new: 'Новая', in_progress: 'В работе', review: 'На проверке', done: 'Выполнена' };
        return h ? `<div class="text-[10px] text-slate-400"><i class="fa-solid fa-clock-rotate-left"></i> ${h.by}: ${L[h.to] || h.to} · ${h.at}</div>` : '';
      }

      renderBell() {
        const host = document.getElementById('header-avatar')?.parentElement;
        if (!host) return;
        let el = document.getElementById('bell');
        if (!el) { host.insertAdjacentHTML('beforebegin', '<div id="bell" class="relative mr-2"></div>'); el = document.getElementById('bell'); }
        const list = (this.notifications || []).slice().reverse(), unread = list.filter(n => !n.read).length;
        el.innerHTML = `<button onclick="app.toggleBell()" class="relative w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"><i class="fa-solid fa-bell"></i>${unread ? `<span class="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-bold rounded-full px-1.5">${unread}</span>` : ''}</button>
          <div id="bell-panel" class="${this._bellOpen ? '' : 'hidden'} absolute right-0 mt-2 w-72 max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl z-40 text-xs">
          ${list.length ? list.map(n => `<div class="p-3 border-b border-slate-100 ${n.read ? 'text-slate-500' : 'font-semibold text-slate-800 bg-indigo-50/50'}">${n.text}<div class="text-[10px] text-slate-400 font-normal">${n.at}</div></div>`).join('') : '<div class="p-4 text-slate-400 text-center">Уведомлений нет</div>'}</div>`;
      }

      async toggleBell() {
        this._bellOpen = !this._bellOpen;
        if (!this._bellOpen && (this.notifications || []).some(n => !n.read)) {
          this.notifications.forEach(n => n.read = true);
          try { await this.api('data?action=read', { method: 'POST', body: {} }); } catch (e) {}
        }
        this.renderBell();
      }

      renderInspectorView() {
        const listEl = document.getElementById('inspector-scheduled-stops');
        if (!listEl) return;

        listEl.innerHTML = this.stops.filter(s => this.isAssigned(s)).map(s => `
          <div onclick="app.selectInspectorStop('${s.id}')" class="p-3 rounded-xl border border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50/50 cursor-pointer transition-colors flex items-center justify-between text-xs">
            <div>
              <div class="font-bold text-slate-800">${s.name}</div>
              <div class="text-[10px] text-slate-500">${s.city} • ${s.district}</div>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${s.status === 'good' ? 'bg-emerald-100 text-emerald-800' : (s.status === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')}">
              ${s.status === 'good' ? 'Исправно' : (s.status === 'warning' ? 'Внимание' : 'Авария')}
            </span>
          </div>
        `).join('');

        const currentId = document.getElementById('insp-stop-id')?.value;
        if (this.stops.length > 0 && !currentId) {
          this.selectInspectorStop(this.stops[0].id);
        }
      }

      selectInspectorStop(stopId) {
        const stop = this.stops.find(s => s.id === stopId);
        if (!stop) return;

        const idEl = document.getElementById('insp-stop-id');
        if (idEl) idEl.value = stop.id;
        const titleEl = document.getElementById('checklist-stop-title');
        if (titleEl) titleEl.textContent = `${stop.name} (${stop.city}, ${stop.district})`;

        const checklistEl = document.getElementById('checklist-elements');
        if (!checklistEl) return;

        checklistEl.innerHTML = CHECKLIST_ITEMS.map((item, idx) => `
          <div class="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50 text-xs">
            <span class="font-semibold text-slate-700 flex items-center gap-2">
              <span class="w-5 h-5 rounded-full bg-white text-slate-500 border border-slate-200 flex items-center justify-center text-[10px] font-bold">${idx + 1}</span>
              ${item.name}
            </span>
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-1 cursor-pointer text-[11px] font-bold text-emerald-700"><input type="radio" name="chk_${item.id}" value="ok" checked class="text-emerald-600"> Норма</label>
              <label class="flex items-center gap-1 cursor-pointer text-[11px] font-bold text-amber-700"><input type="radio" name="chk_${item.id}" value="warning" class="text-amber-600"> Внимание</label>
              <label class="flex items-center gap-1 cursor-pointer text-[11px] font-bold text-rose-700"><input type="radio" name="chk_${item.id}" value="danger" class="text-rose-600"> Авария</label>
            </div>
          </div>
        `).join('');

        this.inspPhotoData = null;
        const prev = document.getElementById('insp-photo-preview');
        if (prev) { prev.innerHTML = ''; prev.classList.add('hidden'); }
        const fileInput = document.getElementById('insp-photo');
        if (fileInput) fileInput.value = '';
      }

      submitInspection(e) {
        e.preventDefault();
        const stopId = document.getElementById('insp-stop-id')?.value;
        const stop = this.stops.find(s => s.id === stopId);
        if (!stop) { this.showToast('Выберите объект осмотра из графика', 'warning'); return; }

        let hasDanger = false;
        let hasWarning = false;
        const results = [];

        CHECKLIST_ITEMS.forEach(item => {
          const val = document.querySelector(`input[name="chk_${item.id}"]:checked`)?.value || 'ok';
          results.push({ item: item.name, value: val });
          if (val === 'danger') hasDanger = true;
          if (val === 'warning') hasWarning = true;
        });

        const resultLevel = hasDanger ? 'danger' : (hasWarning ? 'warning' : 'good');
        const notes = document.getElementById('insp-notes')?.value || '';

        const newInspection = {
          id: 'INS-' + Math.floor(2000 + Math.random() * 8000),
          stopId: stop.id, stopName: stop.name, city: stop.city,
          inspector: this.currentUser.name,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          result: resultLevel, notes: notes, results: results, photo: this.inspPhotoData || null
        };

        this.inspections.unshift(newInspection);
        this.persist('tc_inspections', this.inspections);

        if (hasDanger || hasWarning) {
          const newTicket = {
            id: 'TICK-' + Math.floor(1000 + Math.random() * 9000),
            stopId: stop.id, stopName: stop.name, city: stop.city,
            author: this.currentUser.name + ' (Инспектор)',
            category: hasDanger ? 'Аварийное повреждение конструкций' : 'Плановое устранение дефектов',
            severity: hasDanger ? 'critical' : 'medium',
            status: 'new', contractor: 'Не назначен',
            sla: hasDanger ? '6 часов' : '24 часа',
            createdDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
            description: notes || 'Выявлено несоответствие нормам при инспекторском осмотре.',
            photo: this.inspPhotoData || null
          };
          this.tickets.unshift(newTicket);
          this.persist('tc_tickets', this.tickets);
        }

        this.recalculateStopStatus(stop.id);
        this.showToast(`Акт осмотра ${stop.name} зарегистрирован!`, 'success');

        const notesEl = document.getElementById('insp-notes');
        if (notesEl) notesEl.value = '';
        this.inspPhotoData = null;
        const prev = document.getElementById('insp-photo-preview');
        if (prev) { prev.innerHTML = ''; prev.classList.add('hidden'); }
        const fileInput = document.getElementById('insp-photo');
        if (fileInput) fileInput.value = '';

        this.renderAllViews();
      }

      readAndCompressImage(file, cb) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target.result;
          const img = new Image();
          img.onload = () => {
            try {
              const maxW = 800;
              const scale = Math.min(1, maxW / img.width);
              const canvas = document.createElement('canvas');
              canvas.width = Math.round(img.width * scale);
              canvas.height = Math.round(img.height * scale);
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              cb(canvas.toDataURL('image/jpeg', 0.72));
            } catch (err) { cb(dataUrl); }
          };
          img.onerror = () => cb(dataUrl);
          img.src = dataUrl;
        };
        reader.onerror = () => this.showToast('Не удалось прочитать файл', 'error');
        reader.readAsDataURL(file);
      }

      handleCitizenPhotoUpload(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        this.readAndCompressImage(file, (dataUrl) => {
          this.reportPhotoData = dataUrl;
          const prev = document.getElementById('report-photo-preview');
          if (prev) {
            prev.innerHTML = `<img src="${dataUrl}" class="w-full h-40 object-cover rounded-2xl border border-emerald-200" alt="Предпросмотр">`;
            prev.classList.remove('hidden');
          }
          const label = document.getElementById('report-photo-label');
          if (label) label.textContent = 'Фото прикреплено — нажмите, чтобы заменить';
          this.showToast('Фотофиксация прикреплена к обращению', 'success');
        });
      }

      handleInspPhotoUpload(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        this.readAndCompressImage(file, (dataUrl) => {
          this.inspPhotoData = dataUrl;
          const prev = document.getElementById('insp-photo-preview');
          if (prev) {
            prev.innerHTML = `<img src="${dataUrl}" class="w-full h-40 object-cover rounded-2xl border border-blue-200" alt="Предпросмотр">`;
            prev.classList.remove('hidden');
          }
          this.showToast('Фотофиксация прикреплена к акту', 'success');
        });
      }

      updateReportStopsList(cityOverride) {
        const stopSelect = document.getElementById('report-stop');
        if (!stopSelect) return;
        const currentCity = cityOverride || (this.currentUser ? this.currentUser.city : "Великий Новгород");
        const stopsInCity = this.stops.filter(s => s.city.toLowerCase() === (currentCity || '').toLowerCase());

        if (stopsInCity.length === 0) {
          stopSelect.innerHTML = `<option value="">В вашем городе (${currentCity}) пока нет остановок в реестре</option>`;
        } else {
          stopSelect.innerHTML = stopsInCity.map(s => `<option value="${s.id}">${s.name} (${s.district})</option>`).join('');
        }
      }

      submitCitizenReport(e) {
        e.preventDefault();
        const stopId = document.getElementById('report-stop')?.value;
        const category = document.getElementById('report-category')?.value;
        const desc = document.getElementById('report-description')?.value;
        const stop = this.stops.find(s => s.id === stopId);

        if (!stop) { this.showToast('Выберите зарегистрированный остановочный комплекс!', 'warning'); return; }

        const newTicket = {
          id: 'TICK-' + Math.floor(1000 + Math.random() * 9000),
          stopId: stop.id, stopName: stop.name, city: stop.city,
          author: this.currentUser.name + ' (Житель)',
          category: category,
          severity: (category || '').includes('Разбито') ? 'critical' : 'medium',
          status: 'new', contractor: 'Не назначен', sla: '24 часа',
          createdDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
          description: desc, photo: this.reportPhotoData || null
        };

        this.tickets.unshift(newTicket);
        this.persist('tc_tickets', this.tickets);
        this.recalculateStopStatus(stop.id);

        this.showToast(`Обращение ${newTicket.id} зарегистрировано!`, 'success');

        const descEl = document.getElementById('report-description');
        if (descEl) descEl.value = '';
        this.reportPhotoData = null;
        const prev = document.getElementById('report-photo-preview');
        if (prev) { prev.innerHTML = ''; prev.classList.add('hidden'); }
        const label = document.getElementById('report-photo-label');
        if (label) label.textContent = 'Прикрепить фото повреждения';
        const fileInput = document.getElementById('report-photo');
        if (fileInput) fileInput.value = '';

        this.switchView('citizen-tickets');
        this.renderCitizenTickets();
      }

      renderCitizenTickets() {
        const container = document.getElementById('citizen-tickets-list');
        if (!container || !this.currentUser) return;

        const myTickets = this.tickets.filter(t => (t.author || '').includes(this.currentUser.name) || (t.author || '').includes('Житель'));

        if (myTickets.length === 0) {
          container.innerHTML = `<div class="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400"><i class="fa-solid fa-clipboard-check text-3xl mb-2 text-slate-300"></i><p class="text-xs font-semibold">Вы еще не подавали обращений по состоянию остановок</p></div>`;
          return;
        }

        const statusTimeline = {
          new: { step: 1, label: 'Заявка принята', badge: 'bg-blue-100 text-blue-800' },
          in_progress: { step: 2, label: 'В работе у бригады', badge: 'bg-amber-100 text-amber-800' },
          review: { step: 3, label: 'Контроль качества', badge: 'bg-purple-100 text-purple-800' },
          done: { step: 4, label: 'Устранено', badge: 'bg-emerald-100 text-emerald-800' }
        };

        container.innerHTML = myTickets.map(t => {
          const st = statusTimeline[t.status] || statusTimeline.new;
          return `
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <span class="text-xs font-mono font-bold text-indigo-600">${t.id}</span>
                  <h3 class="text-sm font-bold text-slate-900 mt-0.5">${t.stopName}</h3>
                  <div class="text-[11px] text-slate-500">${t.category} &bull; ${t.city} &bull; ${t.createdDate}</div>
                </div>
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${st.badge}">${st.label}</span>
              </div>
              ${t.description ? `<p class="text-[11px] text-slate-600 bg-slate-50 rounded-xl p-2.5 border border-slate-100">${t.description}</p>` : ''}
              ${t.photo ? `<img src="${t.photo}" class="w-full h-36 object-cover rounded-xl border border-slate-200" alt="Фото обращения">` : ''}
              <div class="grid grid-cols-4 gap-2 pt-1">
                <div class="h-1.5 rounded-full ${st.step >= 1 ? 'bg-indigo-600' : 'bg-slate-200'}"></div>
                <div class="h-1.5 rounded-full ${st.step >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}"></div>
                <div class="h-1.5 rounded-full ${st.step >= 3 ? 'bg-indigo-600' : 'bg-slate-200'}"></div>
                <div class="h-1.5 rounded-full ${st.step >= 4 ? 'bg-emerald-500' : 'bg-slate-200'}"></div>
              </div>
              <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span>Подрядчик: <strong>${t.contractor}</strong></span>
                <span>Регламентный срок (SLA): <strong>${t.sla}</strong></span>
                <button onclick="app.showOnMap('${t.stopId}')" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg transition-colors"><i class="fa-solid fa-map-location-dot mr-1"></i>Показать на карте</button>
              </div>
            </div>
          `;
        }).join('');
      }

      renderRegistryTable() {
        const tbody = document.getElementById('registry-table-body');
        if (!tbody) return;

        tbody.innerHTML = this.stops.map(s => `
          <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-3.5"><div class="font-bold text-slate-800">${s.name}</div><div class="text-[10px] text-slate-400 font-mono">ID: ${s.id}</div></td>
            <td class="p-3.5"><div class="font-semibold text-slate-700">${s.city}</div><div class="text-[10px] text-slate-400">${s.district}</div></td>
            <td class="p-3.5 max-w-xs truncate">${s.routes}</td>
            <td class="p-3.5"><div class="text-[11px] text-slate-500">${(s.equipment || []).slice(0, 3).join(', ')}${(s.equipment || []).length > 3 ? '...' : ''}</div></td>
            <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${s.status === 'good' ? 'bg-emerald-100 text-emerald-800' : (s.status === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')}">${s.status === 'good' ? 'Исправно' : (s.status === 'warning' ? 'Внимание' : 'Аварийно')}</span></td>
            <td class="p-3.5 text-right whitespace-nowrap">
              <button onclick="app.showOnMap('${s.id}')" class="w-7 h-7 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Показать на карте"><i class="fa-solid fa-map-location-dot"></i></button>
              <button onclick="app.editStop('${s.id}')" class="w-7 h-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Редактировать"><i class="fa-solid fa-pen"></i></button>
              <button onclick="app.confirmDeleteStop('${s.id}')" class="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Списать остановку"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `).join('');
      }

      initModalMap(startLat, startLng) {
        const container = document.getElementById('modal-stop-map');
        if (!container) return;

        if (this.modalMap) {
          setTimeout(() => {
            try {
              this.modalMap.invalidateSize();
              if (typeof startLat === 'number' && typeof startLng === 'number') {
                this.modalMap.setView([startLat, startLng], Math.max(this.modalMap.getZoom(), 14));
                this.setModalMapPoint(startLat, startLng, false);
              }
            } catch (e) {}
          }, 180);
          return;
        }

        if (container._leaflet_id) delete container._leaflet_id;
        container.innerHTML = '';

        const initLat = (typeof startLat === 'number' && !isNaN(startLat)) ? startLat : 58.5228;
        const initLng = (typeof startLng === 'number' && !isNaN(startLng)) ? startLng : 31.2698;

        try {
          // attributionControl: false — убираем Leaflet с флагом
          this.modalMap = L.map('modal-stop-map', { zoomControl: true, attributionControl: false })
            .setView([initLat, initLng], 15);

          L.control.attribution({ position: 'bottomright', prefix: false }).addTo(this.modalMap);

          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; Esri', maxZoom: 19
          }).addTo(this.modalMap);

          this.modalMap.on('click', (e) => { this.setModalMapPoint(e.latlng.lat, e.latlng.lng, false); });

          this.setModalMapPoint(initLat, initLng, false);

          setTimeout(() => { try { this.modalMap.invalidateSize(); } catch (e) {} }, 200);
        } catch (e) {
          console.warn('Modal map init error:', e);
        }
      }

      setModalMapPoint(lat, lng, pan = true) {
        lat = Number(lat);
        lng = Number(lng);

        const latEl = document.getElementById('modal-stop-lat');
        const lngEl = document.getElementById('modal-stop-lng');
        if (latEl) latEl.value = lat.toFixed(6);
        if (lngEl) lngEl.value = lng.toFixed(6);

        if (!this.modalMap) return;

        const icon = L.divIcon({
          className: 'modal-pin',
          html: '<div style="width:34px;height:34px;border-radius:9999px;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 14px rgba(79,70,229,.45);border:3px solid #fff;font-size:14px;"><i class="fa-solid fa-location-dot"></i></div>',
          iconSize: [34, 34],
          iconAnchor: [17, 34]
        });

        if (this.modalMarker) {
          this.modalMarker.setLatLng([lat, lng]);
          this.modalMarker.setIcon(icon);
        } else {
          this.modalMarker = L.marker([lat, lng], { icon, draggable: true }).addTo(this.modalMap);
          this.modalMarker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            this.setModalMapPoint(pos.lat, pos.lng, false);
          });
        }

        if (pan) {
          try { this.modalMap.setView([lat, lng], Math.max(this.modalMap.getZoom(), 15)); } catch (e) {}
        }
      }

      openStopModal(prefillCity = '') {
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

        setVal('modal-stop-id', '');
        setVal('modal-stop-name', '');
        setVal('modal-stop-city', (prefillCity && prefillCity !== 'Все города') ? prefillCity : 'Великий Новгород');
        setVal('modal-stop-district', '');
        setVal('modal-stop-lat', '58.522800');
        setVal('modal-stop-lng', '31.269800');
        setVal('modal-stop-routes', '');
        setVal('modal-stop-status', 'good');
        setVal('modal-geocode-query', '');

        const title = document.getElementById('modal-stop-title');
        const subtitle = document.getElementById('modal-stop-subtitle');
        const submitBtn = document.getElementById('modal-stop-submit');
        if (title) title.textContent = 'Добавить остановочный комплекс';
        if (subtitle) subtitle.textContent = 'Укажите объект на карте кликом или перетащите маркер';
        if (submitBtn) submitBtn.textContent = 'Сохранить комплекс';

        document.getElementById('modal-geocode-results')?.classList.add('hidden');
        document.getElementById('modal-stop')?.classList.remove('hidden');

        const cityObj = RUSSIAN_CITIES_CATALOG.find(c => c.name === (prefillCity || 'Великий Новгород'));
        const startLat = cityObj ? cityObj.lat : 58.5228;
        const startLng = cityObj ? cityObj.lng : 31.2698;

        setTimeout(() => { this.initModalMap(startLat, startLng); }, 100);
      }

      editStop(stopId) {
        const stop = this.stops.find(s => s.id === stopId);
        if (!stop) { this.showToast('Объект не найден', 'warning'); return; }

        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

        setVal('modal-stop-id', stop.id);
        setVal('modal-stop-name', stop.name);
        setVal('modal-stop-city', stop.city);
        setVal('modal-stop-district', stop.district);
        setVal('modal-stop-lat', Number(stop.lat).toFixed(6));
        setVal('modal-stop-lng', Number(stop.lng).toFixed(6));
        setVal('modal-stop-routes', stop.routes);
        setVal('modal-stop-status', stop.status);
        setVal('modal-geocode-query', `${stop.city}, ${stop.district}`);

        const title = document.getElementById('modal-stop-title');
        const subtitle = document.getElementById('modal-stop-subtitle');
        const submitBtn = document.getElementById('modal-stop-submit');
        if (title) title.textContent = 'Редактирование остановочного комплекса';
        if (subtitle) subtitle.textContent = `ID объекта: ${stop.id} — переместите маркер для уточнения координат`;
        if (submitBtn) submitBtn.textContent = 'Сохранить изменения';

        document.getElementById('modal-geocode-results')?.classList.add('hidden');
        document.getElementById('modal-stop')?.classList.remove('hidden');

        setTimeout(() => { this.initModalMap(Number(stop.lat), Number(stop.lng)); }, 100);
      }

      closeStopModal() {
        document.getElementById('modal-stop')?.classList.add('hidden');
        if (this.modalMap) { try { this.modalMap.remove(); } catch (e) {} this.modalMap = null; this.modalMarker = null; }
        const container = document.getElementById('modal-stop-map');
        if (container) {
          if (container._leaflet_id) delete container._leaflet_id;
          container.innerHTML = '';
        }
      }

      saveStop(e) {
        e.preventDefault();

        const editId = document.getElementById('modal-stop-id')?.value;
        const city = (document.getElementById('modal-stop-city')?.value || '').trim();
        const district = (document.getElementById('modal-stop-district')?.value || '').trim();
        const name = (document.getElementById('modal-stop-name')?.value || '').trim();
        const lat = parseFloat(document.getElementById('modal-stop-lat')?.value);
        const lng = parseFloat(document.getElementById('modal-stop-lng')?.value);
        const routes = (document.getElementById('modal-stop-routes')?.value || '').trim();
        const status = document.getElementById('modal-stop-status')?.value || 'good';

        if (isNaN(lat) || isNaN(lng)) { this.showToast('Поставьте точку на карте — координаты определятся автоматически', 'warning'); return; }

        if (editId) {
          const stop = this.stops.find(s => s.id === editId);
          if (!stop) { this.showToast('Объект не найден', 'warning'); return; }

          stop.name = name;
          stop.city = city;
          stop.district = district;
          stop.lat = lat;
          stop.lng = lng;
          stop.routes = routes;
          stop.status = status;

          this.persist('tc_stops', this.stops);
          this.closeStopModal();
          this.renderAllViews();
          if (this.map) { try { this.map.setView([lat, lng], 14); } catch(e){} }
          this.showToast(`Изменения объекта «${name}» сохранены`, 'success');
        } else {
          const newStop = {
            id: 'stop-' + Date.now(),
            name, city, district, lat, lng, routes, status,
            installedDate: new Date().toISOString().substring(0, 10),
            equipment: ['Навес', 'Скамья', 'LED-освещение', 'Урна'],
            photo: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80'
          };

          this.stops.push(newStop);
          this.persist('tc_stops', this.stops);
          this.closeStopModal();
          this.renderAllViews();
          this.showToast(`Остановка "${name}" (${city}) сохранена в реестр!`, 'success');
        }
      }

      confirmDeleteStop(stopId) {
        const stop = this.stops.find(s => s.id === stopId);
        if (!stop) return;
        this.showConfirmDialog(
          'Списание объекта',
          `Вы действительно хотите удалить комплекс «${stop.name}» (${stop.city}) из официального реестра?`,
          () => {
            this.stops = this.stops.filter(s => s.id !== stopId);
            this.tickets = this.tickets.filter(t => t.stopId !== stopId);
            this.inspections = this.inspections.filter(i => i.stopId !== stopId);
            this.persist('tc_stops', this.stops);
            this.persist('tc_tickets', this.tickets);
            this.persist('tc_inspections', this.inspections);
            this.selectedStopId = null;
            this.renderAllViews();
            this.showToast('Остановочный комплекс списан из реестра', 'info');
          }
        );
      }

      exportStopsToCSV() {
        let csv = 'ID;Название;Город;Район;Широта;Долгота;Маршруты;Статус\n';
        this.stops.forEach(s => {
          csv += `"${s.id}";"${s.name}";"${s.city}";"${s.district}";"${s.lat}";"${s.lng}";"${s.routes}";"${s.status}"\n`;
        });
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stops_registry_rf_${new Date().toISOString().substring(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Реестр экспортирован в CSV', 'success');
      }

      renderUsersTable() {
        const tbody = document.getElementById('users-table-body');
        if (!tbody) return;

        const roleLabels = { admin: 'Администратор', inspector: 'Инспектор', dispatcher: 'Диспетчер', citizen: 'Житель города' };

        const admin = this.currentUser?.role === 'admin';
        tbody.innerHTML = this.users.map(u => {
          const self = u.id === this.currentUser?.id;
          const roleCell = admin && !self
            ? `<select onchange="app.changeUser('${u.id}', { role: this.value })" class="text-[11px] font-bold border border-slate-300 rounded-lg px-2 py-1 bg-white">${Object.entries(roleLabels).map(([k, v]) => `<option value="${k}" ${k === u.role ? 'selected' : ''}>${v}</option>`).join('')}</select>`
            : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">${roleLabels[u.role] || u.role}</span>`;
          const on = u.active !== false;
          const statCell = admin && !self
            ? `<button onclick="app.changeUser('${u.id}', { active: ${!on} })" class="text-[11px] font-semibold ${on ? 'text-emerald-600' : 'text-rose-600'} hover:underline"><i class="fa-solid ${on ? 'fa-circle-check' : 'fa-ban'} text-[10px] mr-1"></i>${on ? 'Активен' : 'Заблокирован'}</button>`
            : `<span class="text-emerald-600 font-semibold"><i class="fa-solid fa-circle-check text-[10px] mr-1"></i> Активен</span>`;
          return `<tr class="hover:bg-slate-50 transition-colors">
            <td class="p-3.5 font-bold text-slate-800">${u.name}</td>
            <td class="p-3.5 font-mono text-slate-600">${u.email || '—'}</td>
            <td class="p-3.5"><span class="font-semibold text-slate-700">${u.city || '—'}</span>${admin && !self && u.role === 'inspector' ? `<input value="${u.district || ''}" title="Закреплённый район" onchange="app.changeUser('${u.id}', { district: this.value.trim() })" class="text-[10px] border border-slate-300 rounded px-1.5 py-0.5 mt-1 w-32">` : `<span class="text-[10px] text-slate-400 block">${u.district || '—'}</span>`}</td>
            <td class="p-3.5">${roleCell}</td><td class="p-3.5">${statCell}</td></tr>`;
        }).join('');
      }

      renderAnalyticsCharts() {
        const total = this.stops.length;
        const good = this.stops.filter(s => s.status === 'good').length;
        const warning = this.stops.filter(s => s.status === 'warning').length;
        const danger = this.stops.filter(s => s.status === 'danger').length;

        const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setTxt('kpi-total-stops', total);
        setTxt('kpi-health-rate', total > 0 ? Math.round((good / total) * 100) + '%' : '0%');
        setTxt('kpi-active-tickets', this.tickets.filter(t => t.status !== 'done').length);

        if (this.charts.status) { try { this.charts.status.destroy(); } catch(e){} this.charts.status = null; }
        if (this.charts.defects) { try { this.charts.defects.destroy(); } catch(e){} this.charts.defects = null; }

        const ctxStatus = document.getElementById('chart-statuses');
        if (ctxStatus) {
          this.charts.status = new Chart(ctxStatus.getContext('2d'), {
            type: 'doughnut',
            data: { labels: ['Исправно', 'Требует внимания', 'Аварийно'], datasets: [{ data: [good, warning, danger], backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
          });
        }

        const ctxDefects = document.getElementById('chart-defect-types');
        if (ctxDefects) {
          const catCounts = {};
          this.tickets.forEach(t => { catCounts[t.category] = (catCounts[t.category] || 0) + 1; });

          this.charts.defects = new Chart(ctxDefects.getContext('2d'), {
            type: 'bar',
            data: { labels: Object.keys(catCounts), datasets: [{ label: 'Количество инцидентов', data: Object.values(catCounts), backgroundColor: '#6366f1', borderRadius: 6 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
          });
        }
      }

      showToast(msg, type = 'info') {
        const box = document.getElementById('toast-box');
        if (!box) return;

        let bg = 'bg-slate-900 text-white';
        let icon = 'fa-circle-info';
        if (type === 'success') { bg = 'bg-emerald-600 text-white'; icon = 'fa-circle-check'; }
        if (type === 'warning') { bg = 'bg-amber-600 text-white'; icon = 'fa-triangle-exclamation'; }
        if (type === 'error') { bg = 'bg-rose-600 text-white'; icon = 'fa-circle-xmark'; }

        const t = document.createElement('div');
        t.className = `${bg} px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 text-xs font-semibold pointer-events-auto transition-all duration-200 translate-y-2 opacity-0 max-w-xs`;
        t.innerHTML = `<i class="fa-solid ${icon}"></i><span>${msg}</span>`;

        box.appendChild(t);
        requestAnimationFrame(() => t.classList.remove('translate-y-2', 'opacity-0'));

        setTimeout(() => {
          t.classList.add('opacity-0', 'translate-y-2');
          setTimeout(() => t.remove(), 250);
        }, 3200);
      }

      showConfirmDialog(title, message, onConfirm) {
        const modal = document.getElementById('modal-confirm');
        const titleEl = document.getElementById('confirm-title');
        const msgEl = document.getElementById('confirm-message');
        const okBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');

        if (!modal) return;
        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;
        modal.classList.remove('hidden');

        const cleanup = () => {
          modal.classList.add('hidden');
          if (okBtn) okBtn.onclick = null;
          if (cancelBtn) cancelBtn.onclick = null;
        };

        if (okBtn) okBtn.onclick = () => { cleanup(); onConfirm(); };
        if (cancelBtn) cancelBtn.onclick = () => { cleanup(); };
      }

      renderAllViews() {
        this.renderMapMarkers();
        this.renderRegistryTable();
        this.renderDispatcherKanban();
        this.renderInspectorView();
        this.renderCitizenTickets();
        this.renderUsersTable();
        if (this.currentUser && this.currentUser.role === 'citizen') {
          this.updateReportStopsList();
        }
      }
    }

    let app = null;

    function initApplication() {
      if (app) return;
      if (!document.getElementById('auth-screen')) {
        console.warn('initApplication: DOM ещё не готов');
        return;
      }
      try {
        app = new StopMonitoringApp();
        app.init();
        window.app = app;
      } catch (err) {
        console.error('Критическая ошибка инициализации приложения:', err);
        const box = document.getElementById('toast-box');
        if (box) {
          const t = document.createElement('div');
          t.className = 'bg-rose-600 text-white px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold max-w-xs';
          t.innerHTML = '<i class="fa-solid fa-circle-xmark mr-1"></i> Ошибка загрузки интерфейса: ' + (err && err.message ? err.message : 'unknown');
          box.appendChild(t);
        }
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApplication);
    } else {
      initApplication();
    }
  