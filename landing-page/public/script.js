/* ═══════════════════════════════════════════════════════════════════════════
   CLAWFORCE LANDING PAGE — Client Scripts
   ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initAnimations();
  initAgents();
  initLeadForm();
  initStatCounters();
});

/* ═══════════════════════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════════════════════ */
function initNav() {
  const nav = document.getElementById('main-nav');
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');

  // Scroll effect
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    nav.classList.toggle('scrolled', scrollY > 60);
    lastScroll = scrollY;
  }, { passive: true });

  // Mobile toggle
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      links.classList.toggle('open');
      document.body.style.overflow = links.classList.contains('open') ? 'hidden' : '';
    });

    // Close on link click
    links.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        toggle.classList.remove('active');
        links.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCROLL ANIMATIONS
   ═══════════════════════════════════════════════════════════════════════════ */
function initAnimations() {
  const elements = document.querySelectorAll('[data-animate]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = parseInt(entry.target.dataset.delay || '0');
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

/* ═══════════════════════════════════════════════════════════════════════════
   STAT COUNTERS
   ═══════════════════════════════════════════════════════════════════════════ */
function initStatCounters() {
  const stats = document.querySelectorAll('[data-count]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count);
        animateCount(el, 0, target, 1500);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  stats.forEach(el => observer.observe(el));
}

function animateCount(el, start, end, duration) {
  const startTime = performance.now();
  const diff = end - start;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + diff * eased);
    el.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

/* ═══════════════════════════════════════════════════════════════════════════
   AGENTS — Load from Firestore via API
   ═══════════════════════════════════════════════════════════════════════════ */
async function initAgents() {
  const grid = document.getElementById('agents-grid');
  const loading = document.getElementById('agents-loading');

  try {
    const res = await fetch('/api/agents');
    const data = await res.json();

    if (!data.success || !data.agents || data.agents.length === 0) {
      loading.innerHTML = '<p style="color: var(--text-muted);">Agents will be deployed soon. Stay tuned!</p>';
      return;
    }

    // Clear loading
    loading.remove();

    // Render agent cards
    data.agents.forEach((agent, index) => {
      const card = createAgentCard(agent, index);
      grid.appendChild(card);
    });

    // Animate cards in
    requestAnimationFrame(() => {
      grid.querySelectorAll('.agent-card').forEach((card, i) => {
        setTimeout(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, i * 100);
      });
    });

  } catch (err) {
    console.error('Failed to load agents:', err);
    loading.innerHTML = '<p style="color: var(--text-muted);">Unable to load agent roster. Please refresh.</p>';
  }
}

function createAgentCard(agent, index) {
  const card = document.createElement('article');
  card.className = 'agent-card';
  card.id = `agent-${agent.id}`;
  card.style.opacity = '0';
  card.style.transform = 'translateY(20px)';
  card.style.transition = `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.1}s`;

  const initials = agent.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const avatarContent = agent.imageUrl
    ? `<img src="${escapeHtml(agent.imageUrl)}" alt="${escapeHtml(agent.name)}" loading="lazy" />`
    : `<span class="agent-avatar-fallback">${initials}</span>`;

  card.innerHTML = `
    <div class="agent-card-inner">
      <div class="agent-card-top">
        <div class="agent-avatar">${avatarContent}</div>
        <div class="agent-info">
          <h3 class="agent-name">${escapeHtml(agent.name)}</h3>
          <span class="agent-category">${escapeHtml(agent.categoryLabel)}</span>
        </div>
      </div>
      <p class="agent-desc">${escapeHtml(agent.description)}</p>
      <div class="agent-status">
        <span class="agent-status-dot"></span>
        Ready for Deployment
      </div>
    </div>
  `;

  return card;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEAD FORM
   ═══════════════════════════════════════════════════════════════════════════ */
function initLeadForm() {
  const form = document.getElementById('lead-form');
  const submitBtn = document.getElementById('lead-submit');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoading = submitBtn.querySelector('.btn-loading');
  const successEl = document.getElementById('form-success');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous errors
    form.querySelectorAll('.form-input').forEach(i => i.classList.remove('error'));

    const name = document.getElementById('lead-name').value.trim();
    const email = document.getElementById('lead-email').value.trim();
    const company = document.getElementById('lead-company').value.trim();
    const message = document.getElementById('lead-message').value.trim();

    // Validation
    let hasError = false;

    if (!name) {
      document.getElementById('lead-name').classList.add('error');
      hasError = true;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      document.getElementById('lead-email').classList.add('error');
      hasError = true;
    }

    if (hasError) return;

    // Submit
    try {
      btnText.style.display = 'none';
      btnLoading.style.display = 'inline-flex';
      submitBtn.disabled = true;

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company, message })
      });

      const data = await res.json();

      if (data.success) {
        form.style.display = 'none';
        successEl.style.display = 'block';
        successEl.style.animation = 'fadeInUp 0.6s var(--ease-out)';
      } else {
        alert(data.message || 'Something went wrong. Please try again.');
        btnText.style.display = 'inline-flex';
        btnLoading.style.display = 'none';
        submitBtn.disabled = false;
      }
    } catch (err) {
      console.error('Lead submission error:', err);
      alert('Network error. Please check your connection and try again.');
      btnText.style.display = 'inline-flex';
      btnLoading.style.display = 'none';
      submitBtn.disabled = false;
    }
  });

  // Real-time validation clearing
  form.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('input', () => {
      input.classList.remove('error');
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════════════════ */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SMOOTH SCROLL for hash links
   ═══════════════════════════════════════════════════════════════════════════ */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href === '#') return;

    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      const navHeight = document.getElementById('main-nav').offsetHeight;
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 20;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});
