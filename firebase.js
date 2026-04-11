// =============================================
// AADI TOUR & TRAVEL — Firebase Config & Utils
// =============================================

// 🔥 REPLACE THESE WITH YOUR FIREBASE PROJECT DETAILS
// Go to: https://console.firebase.google.com → Your Project → Project Settings → Web App
const firebaseConfig = {
 apiKey: "AIzaSyADiBZe0V5gTnB89Ik1Bby2NDo-9nRxAHc",
  authDomain: "insta-web-upload.firebaseapp.com",
  databaseURL: "https://insta-web-upload-default-rtdb.firebaseio.com",
  projectId: "insta-web-upload",
  storageBucket: "insta-web-upload.firebasestorage.app",
  messagingSenderId: "1092302887537",
  appId: "1:1092302887537:web:a1bb7595868c84c30999d0"
};

// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp, where, limit }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth, collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
         query, orderBy, onSnapshot, serverTimestamp, where, limit,
         signInWithEmailAndPassword, signOut, onAuthStateChanged };

// ─── SHARED UTILITIES ─────────────────────────────────────────────────────────

// Loader hide
export function hideLoader() {
  document.body.style.overflow = '';
  const l = document.getElementById('loader');
  if (l) setTimeout(() => l.classList.add('hidden'), 1400);
}

// Toast notification
export function showToast(msg, type = 'info') {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => toast.classList.remove('show'), 3200);
}

// Navbar scroll + active link
export function initNav(solidOnLoad = false) {
  const nav = document.getElementById('navbar');
  const hbg = document.getElementById('hamburger');
  const nls = document.getElementById('navLinks');

  if (solidOnLoad && nav) nav.classList.add('solid');

  window.addEventListener('scroll', () => {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
    const st = document.getElementById('scrollTopBtn');
    if (st) st.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });

  hbg?.addEventListener('click', () => {
    hbg.classList.toggle('active');
    nls?.classList.toggle('open');
  });
  nls?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      hbg?.classList.remove('active');
      nls?.classList.remove('open');
    });
  });
  document.getElementById('scrollTopBtn')?.addEventListener('click', () =>
    window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// Scroll reveal
export function initReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const siblings = e.target.parentElement?.querySelectorAll('.reveal') || [];
        let delay = 0;
        siblings.forEach((el, i) => { if (el === e.target) delay = i * 90; });
        setTimeout(() => e.target.classList.add('visible'), delay);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

// Active nav link
export function setActiveNav(page) {
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href')?.includes(page));
  });
}

// Format date
export function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Image error fallback
export function imgFallback(img, type = 'landscape') {
  const fallbacks = {
    landscape: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    portrait: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
    tour: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80',
  };
  img.src = fallbacks[type] || fallbacks.landscape;
  img.onerror = null;
}

// Render shared footer
export function renderFooter() {
  const f = document.getElementById('siteFooter');
  if (!f) return;
  f.innerHTML = `
  <footer class="footer">
    <div class="footer-top"><div class="container">
      <div class="footer-grid">
        <div class="footer-col">
          <a href="index.html" class="nav-logo"><span class="logo-a">A</span><span class="logo-text">adi Tour & Travel</span></a>
          <p>Your trusted partner for unforgettable Kashmir journeys. Licensed, verified & loved by travellers.</p>
          <a href="https://makemetop.in/?biz=41fdfe7OZyc2dCK8COnq" target="_blank" class="verified-badge"><i class="fas fa-certificate"></i> Verified on MakeMeTop</a>
          <div class="footer-socials">
            <a href="https://www.facebook.com/profile.php?id=61578478771649" target="_blank"><i class="fab fa-facebook-f"></i></a>
            <a href="https://www.instagram.com/aadi_travel_world" target="_blank"><i class="fab fa-instagram"></i></a>
            <a href="https://youtube.com/@aaditourandtravel" target="_blank"><i class="fab fa-youtube"></i></a>
            <a href="https://wa.me/919596368558" target="_blank"><i class="fab fa-whatsapp"></i></a>
          </div>
        </div>
        <div class="footer-col">
          <h4>Quick Links</h4>
          <ul>
            <li><a href="index.html">Home</a></li>
            <li><a href="about.html">About Us</a></li>
            <li><a href="tours.html">Tour Packages</a></li>
            <li><a href="car-rentals.html">Car Rentals</a></li>
            <li><a href="gallery.html">Gallery</a></li>
            <li><a href="contact.html">Contact</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Services</h4>
          <ul>
            <li><a href="tours.html">Kashmir Tours</a></li>
            <li><a href="tours.html">Honeymoon Packages</a></li>
            <li><a href="car-rentals.html">Taxi Services</a></li>
            <li><a href="contact.html">Hotel Booking</a></li>
            <li><a href="book-now.html">Book Now</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Contact Us</h4>
          <ul>
            <li><i class="fas fa-phone-alt"></i><a href="tel:+919596368558">+91 9596368558</a></li>
            <li><i class="fas fa-phone-alt"></i><a href="tel:+918700116855">+91 8700116855</a></li>
            <li><i class="fas fa-envelope"></i><a href="mailto:aaditourandtravel121@gmail.com">aaditourandtravel121@gmail.com</a></li>
            <li><i class="fas fa-map-marker-alt"></i><span>NH44, Lethipora, Pampore, J&K – 192122</span></li>
          </ul>
        </div>
      </div>
    </div></div>
    <div class="footer-bottom"><div class="container">
      <p>© ${new Date().getFullYear()} Aadi Tour & Travel. All rights reserved.</p>
      <p class="powered">Powered by <a href="https://makemetop.in" target="_blank">MakeMeTop</a></p>
    </div></div>
  </footer>`;
}

// Render shared navbar
export function renderNav(active = '') {
  const n = document.getElementById('siteNav');
  if (!n) return;
  const pages = [
    { href: 'index.html', label: 'Home', key: 'index' },
    { href: 'tours.html', label: 'Tours', key: 'tours' },
    { href: 'car-rentals.html', label: 'Car Rentals', key: 'car-rentals' },
    { href: 'about.html', label: 'About', key: 'about' },
    { href: 'gallery.html', label: 'Gallery', key: 'gallery' },
    { href: 'contact.html', label: 'Contact', key: 'contact' },
  ];
  n.innerHTML = `
  <nav id="navbar">
    <div class="nav-container">
      <a href="index.html" class="nav-logo"><span class="logo-a">A</span><span class="logo-text">adi Tour & Travel</span></a>
      <ul class="nav-links" id="navLinks">
        ${pages.map(p => `<li><a href="${p.href}" class="nav-link${active===p.key?' active':''}">${p.label}</a></li>`).join('')}
        <li><a href="book-now.html" class="nav-btn-cta">Book Now</a></li>
      </ul>
      <button class="hamburger" id="hamburger" aria-label="Menu"><span></span><span></span><span></span></button>
    </div>
  </nav>`;
}

// Shared loader HTML
export function loaderHTML() {
  return `<div id="loader"><div class="loader-inner"><div class="loader-logo"><span class="loader-a">A</span><span class="loader-text">adi Tour & Travel</span></div><div class="loader-bar"><div class="loader-fill"></div></div><p class="loader-tagline">Preparing your Kashmir journey…</p></div></div>`;
}

// WA float + scroll top
export function renderFloats() {
  document.body.insertAdjacentHTML('beforeend', `
    <a href="https://wa.me/919596368558?text=Hi%20Aadi%20Tour%20%26%20Travel!%20I%20want%20to%20enquire%20about%20a%20tour." target="_blank" class="wa-float" aria-label="WhatsApp"><i class="fab fa-whatsapp"></i><span class="wa-tooltip">Chat with us!</span></a>
    <button class="scroll-top-btn" id="scrollTopBtn" aria-label="Scroll to top"><i class="fas fa-chevron-up"></i></button>
    <div class="toast" id="globalToast"></div>
  `);
}
