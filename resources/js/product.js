import './bootstrap';
import './app.js';

const initVariantForms = () => {
    document.querySelectorAll('.variant-form').forEach((form) => {
        if (form.dataset.syncBound === '1') return;
        form.dataset.syncBound = '1';

        const productId = form.dataset.productId;
        const colorSelect = form.querySelector(`.variant-color-select[data-product-id="${productId}"]`);
        const sizeSelect = form.querySelector(`.variant-size-select[data-product-id="${productId}"]`);

        if (!colorSelect || !sizeSelect) return;

        const syncSizes = () => {
            const selectedColor = colorSelect.value;
            let firstVisible = null;

            [...sizeSelect.options].forEach((option) => {
                const visible = option.dataset.color === selectedColor;
                option.hidden = !visible;
                option.disabled = !visible;
                if (visible && !firstVisible) firstVisible = option;
            });

            if (firstVisible) sizeSelect.value = firstVisible.value;
        };

        colorSelect.addEventListener('change', syncSizes);
        syncSizes();
    });
};

document.addEventListener('DOMContentLoaded', () => {
    initVariantForms();
});

