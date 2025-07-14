// Your Golf Course Name - Main JavaScript

// API Base URL (will be replaced by environment variable in production)
const API_BASE_URL = window.location.origin.includes('localhost') 
    ? 'http://localhost:3000/api' 
    : `${window.location.origin}/api`;

// DOM Content Loaded Event
document.addEventListener('DOMContentLoaded', function() {
    // Hide loader after page loads
    setTimeout(() => {
        const loader = document.getElementById('pageLoader');
        if (loader) {
            loader.classList.add('hidden');
            setTimeout(() => {
                loader.style.display = 'none';
            }, 500);
        }
    }, 1000);
    
    initializeWebsite();
});

// Initialize all website functionality
function initializeWebsite() {
    initializeNavigation();
    initializeBookingModal();
    initializeAuthModal();
    initializeCalendar();
    initializeContactForm();
    initializeAnimations();
    initializeScrollEffects();
    checkLoginStatus(); // Check user login status on load
}

// Navigation functionality
function initializeNavigation() {
    const nav = document.querySelector('.header');
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    // Smooth scrolling for navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Header background on scroll
    window.addEventListener('scroll', function() {
        if (window.scrollY > 100) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });
}

// Booking Modal functionality
function initializeBookingModal() {
    const modal = document.getElementById('bookingModal');
    const bookBtns = document.querySelectorAll('.book-now-btn');
    const closeBtn = modal.querySelector('.close');
    
    // Open modal
    bookBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        });
    });
    
    // Close modal
    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
}

// Authentication Modal functionality
function initializeAuthModal() {
    const authModal = document.getElementById('authModal');
    const loginLogoutBtn = document.getElementById('loginLogoutBtn');
    const authModalCloseBtn = authModal.querySelector('.close');
    const authModalTitle = document.getElementById('authModalTitle');

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');

    const showRegisterFormLink = document.getElementById('showRegisterForm');
    const showLoginFormLink = document.getElementById('showLoginForm');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const backToLoginLink = document.getElementById('backToLogin');

    // Show auth modal
    loginLogoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (loginLogoutBtn.textContent === 'Logout') {
            handleLogout();
        } else {
            authModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            showForm('login');
        }
    });

    // Close auth modal
    authModalCloseBtn.addEventListener('click', function() {
        authModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target === authModal) {
            authModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });

    // Form switching
    showRegisterFormLink.addEventListener('click', function(e) {
        e.preventDefault();
        showForm('register');
    });
    showLoginFormLink.addEventListener('click', function(e) {
        e.preventDefault();
        showForm('login');
    });
    forgotPasswordLink.addEventListener('click', function(e) {
        e.preventDefault();
        showForm('forgotPassword');
    });
    backToLoginLink.addEventListener('click', function(e) {
        e.preventDefault();
        showForm('login');
    });

    function showForm(formType) {
        loginForm.classList.add('hidden');
        registerForm.classList.add('hidden');
        forgotPasswordForm.classList.add('hidden');

        if (formType === 'login') {
            loginForm.classList.remove('hidden');
            authModalTitle.textContent = 'Login to Your Account';
        } else if (formType === 'register') {
            registerForm.classList.remove('hidden');
            authModalTitle.textContent = 'Create New Account';
        } else if (formType === 'forgotPassword') {
            forgotPasswordForm.classList.remove('hidden');
            authModalTitle.textContent = 'Reset Your Password';
        }
    }

    // Handle Login
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = loginForm.elements.loginEmail.value;
        const password = loginForm.elements.loginPassword.value;

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('accessToken', data.session.access_token);
                localStorage.setItem('refreshToken', data.session.refresh_token);
                localStorage.setItem('user', JSON.stringify(data.user));
                alert('Login successful!');
                authModal.style.display = 'none';
                document.body.style.overflow = 'auto';
                checkLoginStatus();
            } else {
                alert(`Login failed: ${data.error || data.message}`);
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('An error occurred during login.');
        }
    });

    // Handle Registration
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const firstName = registerForm.elements.registerFirstName.value;
        const lastName = registerForm.elements.registerLastName.value;
        const email = registerForm.elements.registerEmail.value;
        const password = registerForm.elements.registerPassword.value;

        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ first_name: firstName, last_name: lastName, email, password })
            });
            const data = await response.json();

            if (response.ok) {
                alert('Registration successful! Please check your email for verification.');
                showForm('login'); // Go back to login form
            } else {
                alert(`Registration failed: ${data.error || data.message}`);
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('An error occurred during registration.');
        }
    });

    // Handle Forgot Password
    forgotPasswordForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = forgotPasswordForm.elements.forgotEmail.value;

        try {
            const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();

            if (response.ok) {
                alert('Password reset link sent to your email!');
                showForm('login');
            } else {
                alert(`Password reset failed: ${data.error || data.message}`);
            }
        } catch (error) {
            console.error('Forgot password error:', error);
            alert('An error occurred.');
        }
    });
}

// Check login status and update UI
async function checkLoginStatus() {
    const loginLogoutBtn = document.getElementById('loginLogoutBtn');
    const accessToken = localStorage.getItem('accessToken');
    const user = localStorage.getItem('user');

    if (accessToken && user) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/profile`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (response.ok) {
                const userData = await response.json();
                loginLogoutBtn.textContent = `Logout (${userData.user.first_name})`;
                loginLogoutBtn.classList.add('logged-in');
                // Store full user data including role
                localStorage.setItem('user', JSON.stringify(userData.user));
            } else {
                // Token might be expired or invalid, try refreshing
                await refreshAccessToken();
                const newAccessToken = localStorage.getItem('accessToken');
                if (newAccessToken) {
                    // Retry profile fetch
                    const retryResponse = await fetch(`${API_BASE_URL}/auth/profile`, {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${newAccessToken}` }
                    });
                    if (retryResponse.ok) {
                        const userData = await retryResponse.json();
                        loginLogoutBtn.textContent = `Logout (${userData.user.first_name})`;
                        loginLogoutBtn.classList.add('logged-in');
                        localStorage.setItem('user', JSON.stringify(userData.user));
                    } else {
                        handleLogout(false); // Force logout if refresh fails
                    }
                } else {
                    handleLogout(false); // Force logout if refresh fails
                }
            }
        } catch (error) {
            console.error('Error checking login status:', error);
            handleLogout(false); // Force logout on network/other errors
        }
    } else {
        handleLogout(false); // Ensure UI is logged out if no token
    }
}

// Handle Logout
async function handleLogout(callApi = true) {
    const loginLogoutBtn = document.getElementById('loginLogoutBtn');
    const accessToken = localStorage.getItem('accessToken');

    if (callApi && accessToken) {
        try {
            await fetch(`${API_BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
        } catch (error) {
            console.error('Logout API call failed:', error);
        }
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    loginLogoutBtn.textContent = 'Login';
    loginLogoutBtn.classList.remove('logged-in');
    alert('You have been logged out.');
}

// Refresh Access Token
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken })
        });
        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('accessToken', data.session.access_token);
            localStorage.setItem('refreshToken', data.session.refresh_token);
            return true;
        } else {
            console.error('Failed to refresh token:', data.error || data.message);
            return false;
        }
    } catch (error) {
        console.error('Network error during token refresh:', error);
        return false;
    }
}

// Calendar functionality
function initializeCalendar() {
    const currentDate = new Date();
    let selectedDate = null;
    let selectedTime = null;
    
    renderCalendar(currentDate);
    
    function renderCalendar(date) {
        const calendarGrid = document.querySelector('.calendar-grid');
        const monthYear = document.querySelector('.month-year');
        
        if (!calendarGrid || !monthYear) return;
        
        const year = date.getFullYear();
        const month = date.getMonth();
        
        monthYear.textContent = `${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
        
        // Clear previous calendar
        calendarGrid.innerHTML = '';
        
        // Add day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = day;
            dayHeader.style.fontWeight = 'bold';
            dayHeader.style.backgroundColor = 'var(--primary-green)';
            dayHeader.style.color = 'white';
            calendarGrid.appendChild(dayHeader);
        });
        
        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Add empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day empty';
            calendarGrid.appendChild(emptyDay);
        }
        
        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;
            
            const dayDate = new Date(year, month, day);
            const today = new Date();
            
            // Disable past dates
            if (dayDate < today.setHours(0, 0, 0, 0)) {
                dayElement.classList.add('disabled');
                dayElement.style.opacity = '0.5';
                dayElement.style.cursor = 'not-allowed';
            } else {
                dayElement.addEventListener('click', async function() {
                    // Remove previous selection
                    document.querySelectorAll('.calendar-day.selected').forEach(el => {
                        el.classList.remove('selected');
                    });
                    
                    // Select current day
                    this.classList.add('selected');
                    selectedDate = new Date(year, month, day);
                    
                    // Fetch and update available time slots
                    await fetchTimeSlots(selectedDate);
                });
            }
            
            calendarGrid.appendChild(dayElement);
        }
    }
    
    async function fetchTimeSlots(date) {
        const timeSlotsContainer = document.querySelector('.time-slots');
        if (!timeSlotsContainer) return;

        timeSlotsContainer.innerHTML = '<p>Loading available times...</p>';
        
        try {
            const formattedDate = date.toISOString().split('T')[0];
            const response = await fetch(`${API_BASE_URL}/bookings/availability?date=${formattedDate}`);
            const data = await response.json();

            if (response.ok) {
                timeSlotsContainer.innerHTML = ''; // Clear loading message
                if (data.time_slots && data.time_slots.length > 0) {
                    data.time_slots.forEach(slot => {
                        const timeSlot = document.createElement('div');
                        timeSlot.className = 'time-slot';
                        timeSlot.textContent = slot.time;
                        
                        if (!slot.available) {
                            timeSlot.classList.add('unavailable');
                        } else {
                            timeSlot.addEventListener('click', function() {
                                // Remove previous selection
                                document.querySelectorAll('.time-slot.selected').forEach(el => {
                                    el.classList.remove('selected');
                                });
                                
                                // Select current time
                                this.classList.add('selected');
                                selectedTime = slot.time;
                            });
                        }
                        timeSlotsContainer.appendChild(timeSlot);
                    });
                } else {
                    timeSlotsContainer.innerHTML = '<p>No tee times available for this date.</p>';
                }
            } else {
                timeSlotsContainer.innerHTML = `<p>Error fetching times: ${data.error || data.message}</p>`;
            }
        } catch (error) {
            console.error('Error fetching time slots:', error);
            timeSlotsContainer.innerHTML = '<p>Failed to load tee times. Please try again later.</p>';
        }
    }
    
    // Calendar navigation
    document.querySelector('.prev-month')?.addEventListener('click', function() {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate);
    });
    
    document.querySelector('.next-month')?.addEventListener('click', function() {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate);
    });
    
    // Booking form submission
    document.querySelector('.booking-form')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!selectedDate || !selectedTime) {
            alert('Please select a date and time for your tee time.');
            return;
        }
        
        const formData = new FormData(this);
        const bookingData = {
            booking_date: selectedDate.toISOString().split('T')[0],
            tee_time: selectedTime,
            number_of_players: parseInt(formData.get('players')),
            primary_player_name: formData.get('name'),
            primary_player_email: formData.get('email'),
            primary_player_phone: formData.get('phone'),
            cart_rental: formData.get('cart') === 'yes',
            green_fee_type: 'all_day' // Defaulting to all_day for simplicity in template
        };
        
        const accessToken = localStorage.getItem('accessToken');
        const headers = { 'Content-Type': 'application/json' };
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/bookings`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(bookingData)
            });
            const data = await response.json();

            if (response.ok) {
                alert(`Booking confirmed for ${bookingData.primary_player_name} on ${bookingData.booking_date} at ${bookingData.tee_time}!`);
                // If payment is required, redirect to payment page or show payment modal
                if (data.payment_required) {
                    // TODO: Implement Stripe.js client-side payment flow
                    alert('Payment is required for this booking. (Payment integration coming soon!)');
                }
                // Close modal
                document.getElementById('bookingModal').style.display = 'none';
                document.body.style.overflow = 'auto';
                
                // Reset form
                this.reset();
                selectedDate = null;
                selectedTime = null;
                document.querySelectorAll('.calendar-day.selected, .time-slot.selected').forEach(el => {
                    el.classList.remove('selected');
                });
            } else {
                alert(`Booking failed: ${data.error || data.message}`);
            }
        } catch (error) {
            console.error('Booking submission error:', error);
            alert('An error occurred during booking. Please try again.');
        }
    });
}

// Contact form functionality
function initializeContactForm() {
    const contactForm = document.querySelector('.contact-form form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const contactData = {
                name: formData.get('name'),
                email: formData.get('email'),
                subject: formData.get('subject'),
                message: formData.get('message'),
                message_type: formData.get('subject') // Using subject as message_type for simplicity
            };
            
            try {
                const response = await fetch(`${API_BASE_URL}/contact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(contactData)
                });
                const data = await response.json();

                if (response.ok) {
                    alert('Thank you for your message! We will get back to you soon.');
                    this.reset();
                } else {
                    alert(`Failed to send message: ${data.error || data.message}`);
                }
            } catch (error) {
                console.error('Contact form submission error:', error);
                alert('An error occurred while sending your message. Please try again.');
            }
        });
    }
}

// Animation functionality
function initializeAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);
    
    // Observe all sections
    document.querySelectorAll('.section').forEach(section => {
        observer.observe(section);
    });
    
    // Observe feature cards
    document.querySelectorAll('.feature-card').forEach(card => {
        observer.observe(card);
    });
    
    // Observe pricing cards
    document.querySelectorAll('.pricing-card').forEach(card => {
        observer.observe(card);
    });
}

// Scroll effects - Clean and smooth
function initializeScrollEffects() {
    window.addEventListener('scroll', function() {
        const nav = document.querySelector('.header');
        
        // Clean header transition on scroll
        if (window.scrollY > 100) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });
}

// Utility functions (if needed, can be expanded)
// For example, to format dates or times consistently across the frontend.