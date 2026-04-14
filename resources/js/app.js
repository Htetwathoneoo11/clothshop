import './bootstrap';
import './product.js';

// Dashboard interactions + Login page React mount
document.addEventListener('DOMContentLoaded', () => {
    // Mount React forms only on relevant pages
    if (document.getElementById('login-root')) {
        import('./spa/Login.jsx');
    }
    if (document.getElementById('register-root')) {
        import('./Register.jsx');
    }
    if (document.getElementById('profile-root')) {
        import('./Profile.jsx');
    }
    if (document.getElementById('logout-root')) {
        import('./Logout.jsx');
    }
    if (document.getElementById('product-filter-root')) {
        import('./ProductFilter.jsx');
    }

    // Toast notification bubble
    const toast = document.querySelector('.toast-notification');
    if (toast) {
        const hideToast = () => {
            toast.classList.add('toast-hide');
            window.setTimeout(() => {
                toast.remove();
            }, 220);
        };

        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', hideToast);
        }

        window.setTimeout(hideToast, 5000);
    }
    
    // Products carousel (dashboard)
    const track = document.getElementById('productsCarouselTrack');
    const leftArrow = document.querySelector('.products-arrow-left');
    const rightArrow = document.querySelector('.products-arrow-right');

    if (track && leftArrow && rightArrow) {
        const scrollAmount = 260; // px per click (approx one card)

        const scrollLeft = () => {
            track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        };

        const scrollRight = () => {
            track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        };

        leftArrow.addEventListener('click', scrollLeft);
        rightArrow.addEventListener('click', scrollRight);

        // Keyboard support: left/right arrow keys
        document.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowLeft') {
                scrollLeft();
            } else if (event.key === 'ArrowRight') {
                scrollRight();
            }
        });
    }
});

