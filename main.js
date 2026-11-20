// Воображуля - логика страницы и записи онлайн

// ---------- Появление блоков при прокрутке ----------
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

// ---------- Данные мастеров ----------
// days: 0 = воскресенье, 1 = понедельник ... 6 = суббота (как в JS Date.getDay)
const MASTERS = [
  { id: 'anna',  name: 'Анна',  role: 'Старший мастер',            days: [1, 3, 5, 0], schedule: 'Пн, Ср, Пт, Вс' },
  { id: 'mila',  name: 'Мила',  role: 'Модельные стрижки и плетение', days: [2, 4, 6],    schedule: 'Вт, Чт, Сб' },
  { id: 'dasha', name: 'Дарья', role: 'Первые стрижки и прокол ушей', days: [1, 2, 3, 4, 5], schedule: 'Пн-Пт' },
];

const WORK_START = 10 * 60;       // 10:00 в минутах
const WORK_END = 20 * 60;         // 20:00
const SLOT_MINUTES = 45;          // длительность обслуживания

// Состояние записи
const booking = { service: null, date: null, master: null, time: null };

const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const prettyDate = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

function todayStart() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

// ---------- Шаги ----------
function goToStep(n) {
  for (let i = 1; i <= 4; i++) {
    document.getElementById(`step${i}`).hidden = i !== n;
  }
  document.querySelectorAll('.steps__item').forEach((el) => {
    const s = Number(el.dataset.step);
    el.classList.toggle('is-active', s === n);
    el.classList.toggle('is-done', s < n);
  });
  // «Отменить выбор» видна на шагах 2-4, на первом шаге сбрасывать нечего
  document.getElementById('resetBooking').hidden = n === 1;
  document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
}

// ---------- Шаг 1: календарь ----------
let calCursor = new Date();
calCursor.setDate(1);

function renderCalendar() {
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  document.getElementById('calMonth').textContent =
    `${MONTH_NAMES[calCursor.getMonth()]} ${calCursor.getFullYear()}`;

  const today = todayStart();
  const maxDate = new Date(today);
  maxDate.setMonth(maxDate.getMonth() + 2); // запись максимум на 2 месяца вперёд

  document.getElementById('calPrev').disabled =
    calCursor.getFullYear() === today.getFullYear() && calCursor.getMonth() === today.getMonth();

  // Пустые ячейки до первого дня месяца (неделя с понедельника)
  const firstDay = new Date(calCursor);
  const offset = (firstDay.getDay() + 6) % 7;
  for (let i = 0; i < offset; i++) {
    const empty = document.createElement('span');
    empty.className = 'calendar__day is-empty';
    grid.appendChild(empty);
  }

  const daysInMonth = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(calCursor.getFullYear(), calCursor.getMonth(), day);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calendar__day';
    btn.textContent = day;

    const isPast = d < today;
    const isTooFar = d > maxDate;
    const hasMaster = MASTERS.some((m) => m.days.includes(d.getDay()));
    btn.disabled = isPast || isTooFar || !hasMaster;

    if (booking.date && dateKey(d) === dateKey(booking.date)) {
      btn.classList.add('is-selected');
    }
    btn.addEventListener('click', () => {
      booking.date = d;
      booking.master = null;
      booking.time = null;
      renderCalendar();
      renderMasters();
      goToStep(2);
    });
    grid.appendChild(btn);
  }
}

document.getElementById('calPrev').addEventListener('click', () => {
  calCursor.setMonth(calCursor.getMonth() - 1);
  renderCalendar();
});
document.getElementById('calNext').addEventListener('click', () => {
  calCursor.setMonth(calCursor.getMonth() + 1);
  renderCalendar();
});
document.getElementById('service').addEventListener('change', (e) => {
  booking.service = e.target.value;
});

// ---------- Шаг 2: мастера выбранного дня ----------
function renderMasters() {
  document.getElementById('step2Date').textContent = prettyDate(booking.date);
  const list = document.getElementById('mastersList');
  list.innerHTML = '';

  const working = MASTERS.filter((m) => m.days.includes(booking.date.getDay()));
  working.forEach((m) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'master-card';
    card.innerHTML = `
      <span class="master-card__avatar">${m.name[0]}</span>
      <span>
        <span class="master-card__name">${m.name}</span>
        <div class="master-card__meta">${m.role} · работает ${m.schedule}</div>
      </span>`;
    card.addEventListener('click', () => {
      booking.master = m;
      booking.time = null;
      renderSlots();
      goToStep(3);
    });
    list.appendChild(card);
  });
}

// ---------- Шаг 3: слоты по 45 минут ----------
function renderSlots() {
  document.getElementById('step3Master').textContent = booking.master.name;
  document.getElementById('step3Date').textContent = prettyDate(booking.date);
  const list = document.getElementById('slotsList');
  list.innerHTML = '';

  const now = new Date();
  const isToday = dateKey(booking.date) === dateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (let start = WORK_START; start + SLOT_MINUTES <= WORK_END; start += SLOT_MINUTES) {
    const hh = Math.floor(start / 60);
    const mm = start % 60;
    const label = `${pad(hh)}:${pad(mm)}`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot';
    btn.textContent = label;
    // Сегодня прошедшее время и текущий слот недоступны
    if (isToday && start <= nowMinutes) btn.disabled = true;

    btn.addEventListener('click', () => {
      booking.time = label;
      list.querySelectorAll('.slot').forEach((s) => s.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      renderSummary();
      goToStep(4);
    });
    list.appendChild(btn);
  }
}

// ---------- Шаг 4: итог и отправка ----------
function bookingDetailsText() {
  return `Услуга: ${booking.service}\nДата: ${prettyDate(booking.date)}\nМастер: ${booking.master.name}\nВремя: ${booking.time}`;
}

function renderSummary() {
  document.getElementById('bookingSummary').innerHTML =
    `<strong>Ваша запись:</strong><br>${bookingDetailsText().replaceAll('\n', '<br>')}`;
}

let lastMessage = '';

document.getElementById('bookingForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!booking.service || !booking.date || !booking.master || !booking.time) return;

  const messenger = e.submitter?.dataset.messenger || 'whatsapp';
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const comment = document.getElementById('comment').value.trim();

  lastMessage = [
    'Здравствуйте! Хочу записаться в «Воображулю».',
    bookingDetailsText(),
    `Имя: ${name}`,
    `Телефон: ${phone}`,
    comment ? `Комментарий: ${comment}` : null,
  ].filter(Boolean).join('\n');

  if (messenger === 'telegram') {
    // Telegram: открывается выбор чата с готовым текстом (выберите наш диалог)
    window.open(`https://t.me/share/url?url=${encodeURIComponent('Воображуля')}&text=${encodeURIComponent(lastMessage)}`, '_blank', 'noopener');
  } else {
    window.open(`https://wa.me/74957781328?text=${encodeURIComponent(lastMessage)}`, '_blank', 'noopener');
  }

  // Показываем блок подтверждения и форс-мажора
  document.getElementById('step4').hidden = true;
  document.getElementById('successDetails').innerHTML = bookingDetailsText().replaceAll('\n', '<br>');
  document.getElementById('bookingSuccess').hidden = false;
  document.getElementById('bookingSuccess').scrollIntoView({ behavior: 'smooth' });
});

// Форс-мажор: перенос и отмена с готовым текстом
document.getElementById('rescheduleBtn').addEventListener('click', () => {
  const text = `Здравствуйте! Нужно ПЕРЕНЕСТИ запись.\n${bookingDetailsText()}\nПодскажите, пожалуйста, свободное время.`;
  window.open(`https://wa.me/74957781328?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
});
// Полный сброс записи к шагу 1 (без отправки сообщений)
function resetWizard() {
  booking.date = null;
  booking.master = null;
  booking.time = null;
  document.getElementById('bookingForm').reset();
  booking.service = document.getElementById('service').value; // после reset - первая услуга
  document.getElementById('bookingSuccess').hidden = true;
  renderCalendar();
  goToStep(1);
}

document.getElementById('resetBooking').addEventListener('click', resetWizard);

document.getElementById('cancelBtn').addEventListener('click', () => {
  const text = `Здравствуйте! К сожалению, нужно ОТМЕНИТЬ запись.\n${bookingDetailsText()}`;
  window.open(`https://wa.me/74957781328?text=${encodeURIComponent(text)}`, '_blank', 'noopener');

  // Сбрасываем запись: очищаем выбор и возвращаемся к шагу 1
  resetWizard();
});

// ---------- Инициализация ----------
booking.service = document.getElementById('service').value;
renderCalendar();
