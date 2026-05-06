// SW Cleanup / Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado', reg))
            .catch(err => console.warn('Error registrando Service Worker', err));
    });
}

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyDJLupBIAcg3ak72yzTCojgfXUiVJb5-tA",
    authDomain: "gusto---recetario.firebaseapp.com",
    databaseURL: "https://gusto---recetario-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "gusto---recetario",
    storageBucket: "gusto---recetario.firebasestorage.app",
    messagingSenderId: "966929495219",
    appId: "1:966929495219:web:785adead1c98edb28cacc6",
    measurementId: "G-FQMS8GMCGL"
};

// Initialize Firebase
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    try {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase initialized');
    } catch (e) {
        console.error('Firebase init error:', e);
    }
}
const db = firebase.database ? firebase.database() : null;
const auth = firebase.auth ? firebase.auth() : null;

if (!db) console.warn('Firebase Database not available');
if (!auth) console.warn('Firebase Auth not available');

// --- Shared Utilities ---

function getYoutubeEmbedUrl(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="material-icons">${type === 'success' ? 'check_circle' : 'error'}</span>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function shareRecipe(recipe) {
    if (navigator.share) {
        navigator.share({
            title: 'Gusto: ' + recipe.name,
            text: `Mira esta receta: ${recipe.name}\n\nIngredientes:\n${recipe.ingredients}`,
            url: window.location.href
        }).then(() => console.log('Compartido con éxito'))
            .catch((error) => console.log('Error compartiendo', error));
    } else {
        alert('La función de compartir no está disponible en este navegador.');
    }
}

function renderIngredientLine(text) {
    if (!text) return '';
    const parts = text.split('|').map(p => p.trim());
    if (parts.length >= 2 && parts[0]) {
        if (parts[2]) return `${parts[0]} <span class="ing-amount">${parts[1]} ${parts[2]}</span>`;
        return `${parts[0]} <span class="ing-amount">${parts[1]}</span>`;
    }
    return text;
}
