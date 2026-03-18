import './bootstrap';

// Dashboard interactions + Login page React mount
document.addEventListener('DOMContentLoaded', () => {
    // Login page: load React form when root exists (single entry avoids Vite React preamble error)
    if (document.getElementById('login-root')) {
        import('./Login.jsx');
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

