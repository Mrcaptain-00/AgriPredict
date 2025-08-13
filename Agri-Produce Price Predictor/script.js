// FileName: MultipleFiles/script.js
// FileContents:

// --- Data for Dynamic Dropdowns ---
const cropVarieties = {
    "Wheat": ["HD-2967", "PBW-343", "WH-147"],
    "Onion": ["Nashik Red", "Pusa Red", "Agrifound Dark Red"],
    "Tomato": ["Local Red", "Pusa Ruby", "Hybrid Tomato"],
    "Maize": ["Hybrid-1", "PMH-1", "HQPM-1"],
    "Potato": ["Kufri Jyoti", "Kufri Sindhuri", "Kufri Chandramukhi"],
    "Rice": ["Basmati", "Pusa-1121", "Sona Masuri"]
};

// --- DOM Elements (Global References) ---
const appContent = document.getElementById('app-content');
const navLinks = document.querySelectorAll('nav a, .btn[data-page]');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.querySelector('.loading-text');

// Predict Page Elements (initialized when the predict page is loaded)
let cropSelect, varietySelect, predictionForm, resultsSection, minPriceElem, maxPriceElem, modalPriceElem, priceChartCanvas, priceChart;

// Submit Actual Data Page Elements (initialized when the submit-data page is loaded)
let actualCropSelect, actualVarietySelect, actualDataForm;


// --- API Endpoints ---
const PREDICT_API_URL = 'http://127.0.0.1:5000/predict';
const SUBMIT_DATA_API_URL = 'http://127.0.0.1:5000/submit_actual_data';


// --- Initialization Functions for Specific Pages ---

function initializePredictPageElements() {
    if (!cropSelect) { // Only initialize if not already done
        cropSelect = document.getElementById('crop');
        varietySelect = document.getElementById('variety');
        predictionForm = document.getElementById('predictionForm');
        resultsSection = document.getElementById('results-section');
        minPriceElem = document.getElementById('minPrice');
        maxPriceElem = document.getElementById('maxPrice');
        modalPriceElem = document.getElementById('modalPrice');
        priceChartCanvas = document.getElementById('priceChart');

        if (cropSelect && varietySelect) {
            cropSelect.addEventListener('change', () => handleCropChange(cropSelect, varietySelect));
            // Initial call to populate variety if a crop is pre-selected (e.g., from browser history)
            handleCropChange(cropSelect, varietySelect);
        }
        if (predictionForm) {
            predictionForm.addEventListener('submit', handlePredictionSubmit);
            predictionForm.addEventListener('reset', handleFormReset);
        }

        const synchronizedInputsPredict = [
            { sliderId: 'rainfall', textId: 'rainfall_text', displayId: 'rainfall_value_display' },
            { sliderId: 'temperature', textId: 'temperature_text', displayId: 'temperature_value_display' },
            { sliderId: 'humidity', textId: 'humidity_text', displayId: 'humidity_value_display' },
            { sliderId: 'pesticide', textId: 'pesticide_text', displayId: 'pesticide_value_display' }
        ];
        setupSliderSynchronization(synchronizedInputsPredict);

        // Initialize results section with placeholder text
        minPriceElem.innerHTML = '0.00 <span>Rs/qtl</span>';
        maxPriceElem.innerHTML = '0.00 <span>Rs/qtl</span>';
        modalPriceElem.innerHTML = '0.00 <span>Rs/qtl</span>';
        resultsSection.classList.remove('active');
    }
}

function initializeSubmitDataPageElements() {
    if (!actualCropSelect) { // Only initialize if not already done
        actualCropSelect = document.getElementById('actual_crop');
        actualVarietySelect = document.getElementById('actual_variety');
        actualDataForm = document.getElementById('actualDataForm');

        if (actualCropSelect && actualVarietySelect) {
            actualCropSelect.addEventListener('change', () => handleCropChange(actualCropSelect, actualVarietySelect));
            // Initial call to populate variety if a crop is pre-selected
            handleCropChange(actualCropSelect, actualVarietySelect);
        }
        if (actualDataForm) {
            actualDataForm.addEventListener('submit', handleSubmitActualData);
            actualDataForm.addEventListener('reset', handleActualDataFormReset);
        }

        const synchronizedInputsActual = [
            { sliderId: 'actual_rainfall', textId: 'actual_rainfall_text', displayId: 'actual_rainfall_value_display' },
            { sliderId: 'actual_temperature', textId: 'actual_temperature_text', displayId: 'actual_temperature_value_display' },
            { sliderId: 'actual_humidity', textId: 'actual_humidity_text', displayId: 'actual_humidity_value_display' },
            { sliderId: 'actual_pesticide', textId: 'actual_pesticide_text', displayId: 'actual_pesticide_value_display' }
        ];
        setupSliderSynchronization(synchronizedInputsActual);
    }
}


// --- Generic Helper Functions ---

// Function to populate variety dropdown based on selected crop
function handleCropChange(cropDropdown, varietyDropdown) {
    const selectedCrop = cropDropdown.value;
    varietyDropdown.innerHTML = '<option value="">Select Variety</option>'; // Clear existing options
    varietyDropdown.disabled = true; // Disable until a crop is selected

    if (selectedCrop && cropVarieties[selectedCrop]) {
        cropVarieties[selectedCrop].forEach(variety => {
            const option = document.createElement('option');
            option.value = variety;
            option.textContent = variety;
            varietyDropdown.appendChild(option);
        });
        varietyDropdown.disabled = false; // Enable variety dropdown
    }
}

// Generic function to set up slider synchronization
function setupSliderSynchronization(inputsArray) {
    inputsArray.forEach(({ sliderId, textId, displayId }) => {
        const slider = document.getElementById(sliderId);
        const textInput = document.getElementById(textId);
        const valueDisplay = document.getElementById(displayId);

        if (slider && textInput && valueDisplay) {
            // Slider to Text Input and Value Display synchronization
            slider.addEventListener('input', () => {
                textInput.value = parseFloat(slider.value).toFixed(slider.step.includes('.') ? 2 : 0);
                valueDisplay.textContent = parseFloat(slider.value).toFixed(slider.step.includes('.') ? 2 : 0);
            });

            // Text Input to Slider and Value Display synchronization
            textInput.addEventListener('input', () => {
                let value = parseFloat(textInput.value);
                const min = parseFloat(textInput.min);
                const max = parseFloat(textInput.max);
                const step = parseFloat(textInput.step);

                // Clamp value within min/max range
                if (isNaN(value) || value < min) {
                    value = min;
                } else if (value > max) {
                    value = max;
                }
                // Round to nearest step to avoid floating point issues with range input
                value = Math.round(value / step) * step;

                slider.value = value;
                valueDisplay.textContent = value.toFixed(textInput.step.includes('.') ? 2 : 0);
            });

            // Initialize values on load
            textInput.value = parseFloat(slider.value).toFixed(slider.step.includes('.') ? 2 : 0);
            valueDisplay.textContent = parseFloat(slider.value).toFixed(slider.step.includes('.') ? 2 : 0);
        }
    });
}

// Generic function to reset slider inputs
function resetSliderInputs(inputsArray) {
    inputsArray.forEach(({ sliderId, textId, displayId, defaultValue }) => {
        const slider = document.getElementById(sliderId);
        const textInput = document.getElementById(textId);
        const valueDisplay = document.getElementById(displayId);

        if (slider && textInput && valueDisplay) {
            slider.value = defaultValue;
            textInput.value = defaultValue.toFixed(slider.step.includes('.') ? 2 : 0);
            valueDisplay.textContent = defaultValue.toFixed(slider.step.includes('.') ? 2 : 0);
        }
    });
}

// --- Page Routing Logic (SPA Simulation) ---
function showPage(pageId) {
    const currentActive = document.querySelector('.page-section.active');
    if(currentActive) {
        currentActive.classList.remove('active');
    }

    const targetPage = document.getElementById(pageId + '-page');
    if(targetPage) {
        targetPage.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Initialize elements specific to the newly shown page
        if (pageId === 'predict') {
            initializePredictPageElements();
        } else if (pageId === 'submit-data') {
            initializeSubmitDataPageElements();
        }
    }
}

// Handle navigation clicks
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const pageId = link.getAttribute('data-page');
        if (pageId) {
            history.pushState(null, '', `#${pageId}`); // Update URL hash
            showPage(pageId);
        }
    });
});

// Handle initial page load and hash changes
window.addEventListener('hashchange', () => {
    const pageId = window.location.hash.substring(1) || 'home';
    showPage(pageId);
});

// Initial page load
document.addEventListener('DOMContentLoaded', () => {
    const initialPageId = window.location.hash.substring(1) || 'home';
    showPage(initialPageId);
    // Ensure elements are initialized if the page is the initial one
    if (initialPageId === 'predict') {
        initializePredictPageElements();
    } else if (initialPageId === 'submit-data') {
        initializeSubmitDataPageElements();
    }
});


// --- Prediction Form Functionality ---

async function handlePredictionSubmit(e) {
    e.preventDefault();

    const loadingMessages = [
        "Analyzing market trends...",
        "Crunching the numbers...",
        "Generating your forecast...",
        "Processing agricultural data..."
    ];
    let messageIndex = 0;
    loadingText.textContent = loadingMessages[messageIndex];
    const messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        loadingText.textContent = loadingMessages[messageIndex];
    }, 1500);

    loadingOverlay.classList.add('active');

    const formData = new FormData(predictionForm);
    const data = Object.fromEntries(formData.entries());

    // Ensure numerical values are parsed correctly for the backend
    data.rainfall = parseFloat(data.rainfall);
    data.temperature = parseFloat(data.temperature);
    data.arrival = parseFloat(data.arrival);
    data.humidity = parseFloat(data.humidity);
    data.pesticide = parseFloat(data.pesticide);

    try {
        const response = await fetch(PREDICT_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            let errorMessage = "Prediction failed. Please check your inputs and try again.";
            if (errorData && errorData.messages) {
                errorMessage = "Input Error:\n" + Object.values(errorData.messages).flat().join("\n");
            } else if (errorData && errorData.error) {
                errorMessage = `Error: ${errorData.error}`;
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();

        animateNumber(minPriceElem, result.min_price);
        animateNumber(maxPriceElem, result.max_price);
        animateNumber(modalPriceElem, result.modal_price);

        updatePriceChart(result.min_price, result.max_price, result.modal_price);

        clearInterval(messageInterval);
        loadingOverlay.classList.remove('active');

        resultsSection.classList.add('active');
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (error) {
        console.error("Error during prediction:", error);
        clearInterval(messageInterval);
        loadingOverlay.classList.remove('active');
        alert(`Prediction failed: ${error.message}`);
        resultsSection.classList.remove('active');
    }
}

function handleFormReset() {
    varietySelect.innerHTML = '<option value="">Select Variety</option>';
    varietySelect.disabled = true;
    resultsSection.classList.remove('active');

    const synchronizedInputsPredict = [
        { sliderId: 'rainfall', textId: 'rainfall_text', displayId: 'rainfall_value_display', defaultValue: 50.0 },
        { sliderId: 'temperature', textId: 'temperature_text', displayId: 'temperature_value_display', defaultValue: 25.0 },
        { sliderId: 'humidity', textId: 'humidity_text', displayId: 'humidity_value_display', defaultValue: 60.0 },
        { sliderId: 'pesticide', textId: 'pesticide_text', displayId: 'pesticide_value_display', defaultValue: 3.00 }
    ];
    resetSliderInputs(synchronizedInputsPredict);
    document.getElementById('arrival').value = 1000;

    minPriceElem.innerHTML = '0.00 <span>Rs/qtl</span>';
    maxPriceElem.innerHTML = '0.00 <span>Rs/qtl</span>';
    modalPriceElem.innerHTML = '0.00 <span>Rs/qtl</span>';

    if (priceChart) {
        priceChart.destroy();
        priceChart = null;
    }
}


// --- Submit Actual Data Form Functionality ---

async function handleSubmitActualData(e) {
    e.preventDefault();

    loadingOverlay.classList.add('active');
    loadingText.textContent = "Submitting actual data...";
    let messageInterval = null; // Initialize to null

    try {
        const formData = new FormData(actualDataForm);
        const data = Object.fromEntries(formData.entries());

        // Ensure numerical values are parsed correctly
        data.rainfall = parseFloat(data.rainfall);
        data.temperature = parseFloat(data.temperature);
        data.arrival = parseFloat(data.arrival);
        data.humidity = parseFloat(data.humidity);
        data.pesticide = parseFloat(data.pesticide);
        data.min_price = parseFloat(data.min_price);
        data.max_price = parseFloat(data.max_price);
        data.modal_price = parseFloat(data.modal_price);

        // Log data being sent for debugging
        console.log("Sending actual data:", data);

        const response = await fetch(SUBMIT_DATA_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            let errorMessage = "Failed to submit actual data. Please check your inputs.";
            if (errorData && errorData.messages) {
                errorMessage = "Input Error:\n" + Object.values(errorData.messages).flat().join("\n");
            } else if (errorData && errorData.error) {
                errorMessage = `Error: ${errorData.error}`;
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        alert(result.message);
        actualDataForm.reset(); // Reset the form on successful submission

    } catch (error) {
        console.error("Error submitting actual data:", error);
        alert(`Submission failed: ${error.message}`);
    } finally {
        if (messageInterval) clearInterval(messageInterval); // Clear interval if it was set
        loadingOverlay.classList.remove('active');
    }
}

function handleActualDataFormReset() {
    actualVarietySelect.innerHTML = '<option value="">Select Variety</option>';
    actualVarietySelect.disabled = true;

    const synchronizedInputsActual = [
        { sliderId: 'actual_rainfall', textId: 'actual_rainfall_text', displayId: 'actual_rainfall_value_display', defaultValue: 50.0 },
        { sliderId: 'actual_temperature', textId: 'actual_temperature_text', displayId: 'actual_temperature_value_display', defaultValue: 25.0 },
        { sliderId: 'actual_humidity', textId: 'actual_humidity_text', displayId: 'actual_humidity_value_display', defaultValue: 60.0 },
        { sliderId: 'actual_pesticide', textId: 'actual_pesticide_text', displayId: 'actual_pesticide_value_display', defaultValue: 3.00 }
    ];
    resetSliderInputs(synchronizedInputsActual);
    document.getElementById('actual_arrival').value = 1000;

    document.getElementById('actual_min_price').value = '';
    document.getElementById('actual_max_price').value = '';
    document.getElementById('actual_modal_price').value = '';
}


// --- Price Counter Animation ---
function animateNumber(element, targetValue) {
    const startValue = parseFloat(element.textContent.split(' ')[0]);
    const duration = 1000; // milliseconds
    let startTime = null;

    function easeOutQuad(t) {
        return t * (2 - t);
    }

    function step(currentTime) {
        if (!startTime) startTime = currentTime;
        const progress = (currentTime - startTime) / duration;
        const easedProgress = easeOutQuad(progress);

        const currentValue = startValue + (targetValue - startValue) * easedProgress;
        element.innerHTML = `${currentValue.toFixed(2)} <span>Rs/qtl</span>`;

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            element.innerHTML = `${targetValue.toFixed(2)} <span>Rs/qtl</span>`; // Ensure final value is exact and formatted
        }
    }
    requestAnimationFrame(step);
}


// --- Chart.js Initialization and Update ---
function updatePriceChart(min, max, modal) {
    const ctx = priceChartCanvas.getContext('2d');

    if (priceChart) {
        priceChart.destroy(); // Destroy previous chart instance
    }

    priceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Min Price', 'Modal Price', 'Max Price'],
            datasets: [{
                label: 'Price (Rs/qtl)',
                data: [min, modal, max],
                backgroundColor: [
                    'rgba(255, 152, 0, 0.7)', /* Orange for Min */
                    'rgba(3, 169, 244, 0.7)', /* Blue for Modal */
                    'rgba(139, 195, 74, 0.7)'  /* Light Green for Max */
                ],
                borderColor: [
                    'rgba(255, 152, 0, 1)',
                    'rgba(3, 169, 244, 1)',
                    'rgba(139, 195, 74, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1200, // Animation duration for bars
                easing: 'easeOutQuart',
                onComplete: () => {
                    // Trigger price card animations after chart is drawn
                    document.querySelectorAll('.price-card').forEach(card => {
                        card.style.animation = ''; // Reset animation to allow re-trigger
                        card.style.opacity = 0;
                        card.style.transform = 'translateY(20px)';
                        setTimeout(() => {
                            card.style.animation = 'slideUpFadeIn 0.8s ease-out forwards';
                        }, 50); // Small delay to ensure reset
                    });
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    },
                    ticks: {
                        color: 'var(--color-text-light)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    },
                    ticks: {
                        color: 'var(--color-text-light)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false,
                    labels: {
                        color: 'var(--color-text-light)'
                    }
                },
                title: {
                    display: true,
                    text: 'Predicted Price Distribution',
                    color: 'var(--color-text-light)',
                    font: {
                        size: 18,
                        family: 'Poppins'
                    }
                }
            }
        }
    });
}

// --- Scroll-triggered animations (Intersection Observer) ---
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        } else {
            // entry.target.classList.remove('visible'); // Uncomment if you want animation to replay on scroll back
        }
    });
}, observerOptions);

// Observe elements for scroll animations
document.querySelectorAll('.feature-card, .prediction-section, .results-section, .about-section, .contact-section, .data-submission-section').forEach(section => {
    observer.observe(section);
});

// --- Contact Form Simulation ---
// FileName: MultipleFiles/script.js
// FileContents:

// ... (previous JavaScript code) ...

// --- Contact Form Simulation ---
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        loadingOverlay.classList.add('active');
        loadingText.textContent = "Sending message...";

        // Get form data
        const formData = new FormData(contactForm);
        const templateParams = {
            from_name: formData.get('from_name'),
            from_email: formData.get('from_email'),
            message: formData.get('message')
        };

        // Replace with your actual EmailJS Service ID and Template ID
        const serviceID = 'service_r86w4sl'; 
        const templateID = 'template_ca62lk1';

        try {
            // Send email using EmailJS
            await emailjs.send(serviceID, templateID, templateParams);

            loadingOverlay.classList.remove('active');
            alert('Thank you for your message! We will get back to you soon.');
            contactForm.reset(); // Reset the form on successful submission

        } catch (error) {
            console.error("Error sending message:", error);
            loadingOverlay.classList.remove('active');
            alert('Failed to send message. Please try again later.');
        }
    });
}

// ... (rest of JavaScript code) ...

