// static/js/script.js - Reverted to showMessage and alert()

// Helper function to show messages (re-introduced)
function showMessage(elementId, message, type) {
    const messageElement = document.getElementById(elementId);
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = `message ${type}`;
        messageElement.style.display = 'block';
        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 5000); // Hide after 5 seconds
    }
}

// Function to check if current page is admin dashboard
function is_admin_dashboard_page() {
    return window.location.pathname === '/admin-dashboard';
}

// --- Frontend (Homepage and Book Event) Functions ---

function getCardClassAndIcon(packageName) {
    const lowerName = packageName.toLowerCase();
    if (lowerName.includes('birthday')) return { class: 'birthday', icon: 'fas fa-birthday-cake' };
    if (lowerName.includes('dj')) return { class: 'dj-night', icon: 'fas fa-music' };
    if (lowerName.includes('private')) return { class: 'private-party', icon: 'fas fa-users' };
    if (lowerName.includes('wedding')) return { class: 'wedding', icon: 'fas fa-heart' };
    if (lowerName.includes('corporate')) return { class: 'corporate', icon: 'fas fa-building' };
    if (lowerName.includes('photo')) return { class: 'photo-shoot', icon: 'fas fa-camera' };
    return { class: 'default', icon: 'fas fa-star' }; // Default if no match
}

async function fetchEventPackages() {
    const eventPackagesContainer = document.getElementById('event-packages-container');
    if (!eventPackagesContainer) return; // Exit if container not found

    eventPackagesContainer.innerHTML = '<p>Loading events...</p>'; // Show loading message

    try {
        const response = await fetch('/api/event-packages');
        const data = await response.json();
        renderEventPackages(data);
    } catch (error) {
        console.error('Error fetching event packages:', error);
        // Reverted to inline message
        eventPackagesContainer.innerHTML = '<p class="error-message">Failed to load event packages. Please try again later.</p>';
    }
}

function renderEventPackages(packages) {
    const eventPackagesContainer = document.getElementById('event-packages-container');
    eventPackagesContainer.innerHTML = ''; // Clear loading message

    if (packages.length === 0) {
        eventPackagesContainer.innerHTML = '<p>No event packages available at the moment.</p>';
        return;
    }

    packages.forEach(pkg => {
        const packageCard = document.createElement('div');
        const { class: cardClass, icon: cardIcon } = getCardClassAndIcon(pkg.package_name);
        packageCard.className = `package-card ${cardClass}`; // Add dynamic class for styling

        let inclusionsHtml = '<ul>';
        if (pkg.what_included && Array.isArray(pkg.what_included)) {
            pkg.what_included.forEach(item => {
                inclusionsHtml += `<li><i class="fas fa-check-circle"></i> ${item}</li>`;
            });
        } else if (typeof pkg.what_included === 'string') {
            pkg.what_included.split(',').forEach(item => {
                inclusionsHtml += `<li><i class="fas fa-check-circle"></i> ${item.trim()}</li>`;
            });
        }
        inclusionsHtml += '</ul>';

        packageCard.innerHTML = `
            <div class="package-icon">
                <i class="${cardIcon}"></i>
            </div>
            <div class="package-card-content">
                <h3>${pkg.package_name}</h3>
                <p>${pkg.description || ''}</p>
                <h4>What's Included:</h4>
                ${inclusionsHtml}
                <p class="price">${pkg.price ? `₹${pkg.price.toLocaleString()}` : 'Price on request'}</p>
                <button class="btn book-event-btn" data-package-id="${pkg.package_id}">Book This Event</button>
            </div>
        `;
        eventPackagesContainer.appendChild(packageCard);
    });

    // Add event listeners to "Book This Event" buttons
    document.querySelectorAll('.book-event-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const packageId = e.target.dataset.packageId;
            sessionStorage.setItem('selectedPackageId', packageId);
            window.location.href = '/book-event';
        });
    });
}

// Function to handle booking form submission
async function handleBookingFormSubmit(event) {
    event.preventDefault();

    // Reverted to inline message element
    const formMessage = document.getElementById('formMessage');
    if (formMessage) formMessage.style.display = 'none';

    const formData = {
        package_id: document.getElementById('package_id').value,
        full_name: document.getElementById('full_name').value,
        phone_number: document.getElementById('phone_number').value,
        email_address: document.getElementById('email_address').value,
        preferred_date: document.getElementById('preferred_date').value,
        location: document.getElementById('location').value,
        expected_guests: document.getElementById('expected_guests').value,
        additional_requirements: document.getElementById('additional_requirements').value
    };

    try {
        const response = await fetch('/api/book-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            // Reverted to showMessage for inline display
            showMessage('formMessage', data.message || 'Booking request submitted successfully!', 'success');
            // Refresh the page after a successful booking to clear the form
            setTimeout(() => {
                window.location.reload(); // Reloads the current page
            }, 2000); // Wait 2 seconds so the user can see the message

        } else {
            // Reverted to showMessage for inline display
            showMessage('formMessage', data.message || 'Booking submission failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        // Reverted to showMessage for inline display
        showMessage('formMessage', 'An error occurred. Please try again.', 'error');
    }
}


// --- Admin Dashboard Functions ---

async function fetchDashboardStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const stats = await response.json();
        document.getElementById('total-bookings-stat').textContent = stats.total_bookings;
        document.getElementById('pending-bookings-stat').textContent = stats.pending_review;
        document.getElementById('confirmed-bookings-stat').textContent = stats.confirmed;
        document.getElementById('rejected-bookings-stat').textContent = stats.rejected;
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        // Reverted to showMessage for inline display
        showMessage('adminMessage', 'Failed to load dashboard stats.', 'error');
    }
}

async function fetchBookings() {
    const bookingsList = document.getElementById('bookings-list');
    if (!bookingsList) return; // Exit if element not found

    bookingsList.innerHTML = '<p>Loading bookings...</p>';
    const filter = document.getElementById('booking-filter') ? document.getElementById('booking-filter').value : 'All';

    try {
        const response = await fetch(`/api/admin/bookings?status=${filter}`);
        const data = await response.json(); // It's common to name this 'data'
        renderBookings(data); // Pass the fetched data to renderBookings
    } catch (error) {
        console.error('Error fetching bookings:', error);
        // Reverted to inline error message and showMessage for inline display
        bookingsList.innerHTML = '<p class="error-message">Failed to load bookings. Please try again later.</p>';
        showMessage('adminMessage', 'Failed to load bookings. Please try again later.', 'error');
    }
}

function renderBookings(bookings) {
    const bookingsList = document.getElementById('bookings-list');
    bookingsList.innerHTML = ''; // Clear loading message

    if (bookings.length === 0) {
        bookingsList.innerHTML = '<p>No bookings found for this filter.</p>';
        return;
    }

    bookings.forEach(booking => {
        const bookingCard = document.createElement('div');
        bookingCard.className = 'card booking-card';

        let statusClass = '';
        if (booking.status === 'Pending Review') {
            statusClass = 'pending-review';
        } else if (booking.status === 'Confirmed') {
            statusClass = 'confirmed';
        } else if (booking.status === 'Rejected') {
            statusClass = 'rejected';
        }

        const formattedDate = new Date(booking.preferred_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const eventIcon = getCardClassAndIcon(booking.package_name).icon;

        bookingCard.innerHTML = `
            <h3><i class="fas fa-user"></i> ${booking.full_name} <span class="status-badge ${statusClass}">${booking.status}</span></h3>
            <p><i class="fas fa-envelope"></i> ${booking.email_address}</p>
            <p><i class="fas fa-phone"></i> ${booking.phone_number}</p>
            <p><i class="${eventIcon}"></i> ${booking.package_name}</p>
            <p><i class="fas fa-calendar-alt"></i> ${formattedDate}</p>
            <p><i class="fas fa-map-marker-alt"></i> ${booking.location}</p>
            <p><i class="fas fa-users"></i> ${booking.expected_guests} guests</p>
            ${booking.additional_requirements ? `<p><i class="fas fa-info-circle"></i> ${booking.additional_requirements}</p>` : ''}
            <div class="booking-actions">
                ${booking.status !== 'Confirmed' ? `<button class="btn confirm-btn action-btn" data-id="${booking.booking_id}" data-status="Confirmed">Confirm</button>` : ''}
                ${booking.status !== 'Rejected' ? `<button class="btn reject-btn action-btn" data-id="${booking.booking_id}" data-status="Rejected">Reject</button>` : ''}
                <button class="btn delete-btn action-btn" data-id="${booking.booking_id}">Delete</button>
            </div>
        `;
        bookingsList.appendChild(bookingCard);
    });

    // Debugging logs for event listener attachment (kept for your debugging)
    console.log("Attempting to attach event listeners to Confirm/Reject/Delete buttons...");
    const confirmButtons = document.querySelectorAll('.confirm-btn');
    console.log("Found Confirm buttons:", confirmButtons.length);
    confirmButtons.forEach(btn => {
        btn.addEventListener('click', updateBookingStatus);
        console.log(`Attached listener to Confirm button for Booking ID: ${btn.dataset.id}`);
    });

    const rejectButtons = document.querySelectorAll('.reject-btn');
    console.log("Found Reject buttons:", rejectButtons.length);
    rejectButtons.forEach(btn => {
        btn.addEventListener('click', updateBookingStatus);
        console.log(`Attached listener to Reject button for Booking ID: ${btn.dataset.id}`);
    });

    const deleteButtons = document.querySelectorAll('.delete-btn');
    console.log("Found Delete buttons:", deleteButtons.length);
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', deleteBooking);
        console.log(`Attached listener to Delete button for Booking ID: ${btn.dataset.id}`);
    });
    console.log("Finished attaching event listeners.");
}

async function updateBookingStatus(event) {
    console.log("--- updateBookingStatus called ---");
    console.log("Event target:", event.target);

    const bookingId = event.target.dataset.id;
    const newStatus = event.target.dataset.status;

    console.log('Attempting to update booking status...');
    console.log('Booking ID from dataset:', bookingId);
    console.log('New Status from dataset:', newStatus);

    if (!bookingId || !newStatus) {
        console.error("Missing bookingId or newStatus from button's data attributes.");
        // Reverted to showMessage for inline display
        showMessage('adminMessage', 'Error: Booking ID or new status is missing.', 'error');
        return;
    }

    try {
        console.log(`Sending PUT request to /api/admin/bookings/${bookingId}/status`);
        console.log(`Request Body: ${JSON.stringify({ status: newStatus })}`);

        const response = await fetch(`/api/admin/bookings/${bookingId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await response.json();
        console.log('API Response:', data);
        console.log('Response Status:', response.status);

        if (response.ok) {
            // Reverted to showMessage for inline display
            showMessage('adminMessage', data.message, 'success');
            console.log('Status update successful. Refreshing data...');
            fetchBookings();
            fetchDashboardStats();
            fetchBusyDates();
        } else {
            console.error('Status update failed:', data.message || 'Unknown error');
            // Reverted to showMessage for inline display
            showMessage('adminMessage', data.message || 'Failed to update status.', 'error');
        }
    } catch (error) {
        console.error('Catch block: Error updating booking status:', error);
        // Reverted to showMessage for inline display
        showMessage('adminMessage', 'An error occurred while updating status. Check console for details.', 'error');
    }
}

async function deleteBooking(event) {
    const bookingId = event.target.dataset.id;
    // Reverted to standard browser confirm dialog
    if (!confirm('Are you sure you want to delete this booking?')) {
        return;
    }
    try {
        const response = await fetch(`/api/admin/bookings/${bookingId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (response.ok) {
            // Reverted to showMessage for inline display
            showMessage('adminMessage', data.message, 'success');
            fetchBookings();
            fetchDashboardStats();
            fetchBusyDates(); // Refresh busy dates on delete as well
        } else {
            // Reverted to showMessage for inline display
            showMessage('adminMessage', data.message || 'Failed to delete booking.', 'error');
        }
    } catch (error) {
        console.error('Error deleting booking:', error);
        // Reverted to showMessage for inline display
        showMessage('adminMessage', 'An error occurred while deleting booking.', 'error');
    }
}


async function fetchBusyDates() {
    const busyDatesList = document.getElementById('busy-dates-list');
    if (!busyDatesList) return;

    busyDatesList.innerHTML = '<p>Loading busy dates...</p>';
    try {
        const response = await fetch('/api/admin/busy-dates');
        const busyDates = await response.json();
        console.log("fetchBusyDates: Data received from API:", busyDates); // <-- ADD THIS
        renderBusyDates(busyDates);
    } catch (error) {
        console.error('Error fetching busy dates:', error);
        // Reverted to showMessage for inline display
        showMessage('adminMessage', 'Failed to load busy dates.', 'error');
    }
}

function renderBusyDates(busyDates) {
    console.log("renderBusyDates: Rendering with data:", busyDates); // <-- ADD THIS
    const busyDatesList = document.getElementById('busy-dates-list');
    busyDatesList.innerHTML = ''; // Clear loading message

    if (busyDates.length === 0) {
        busyDatesList.innerHTML = '<p>No busy dates currently.</p>';
        console.log("renderBusyDates: No busy dates to display."); // <-- ADD THIS
        return;
    }

    busyDates.forEach(dateEntry => {
        console.log("renderBusyDates: Processing dateEntry:", dateEntry); // <-- ADD THIS
        const busyDateItem = document.createElement('div');
        busyDateItem.className = 'busy-date-item card'; // Ensure 'card' class for styling
        // Make sure busy_dates table has 'date' column as DATE type
        // and your query returns it as such.
        const formattedDate = new Date(dateEntry.date).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        let bookingsHtml = '<ul>';
        if (dateEntry.bookings && dateEntry.bookings.length > 0) {
            dateEntry.bookings.forEach(booking => {
                bookingsHtml += `<li>${booking.full_name} - ${booking.package_name}</li>`;
            });
        } else {
            bookingsHtml += `<li>No confirmed bookings for this date.</li>`; // Fallback message
        }
        bookingsHtml += '</ul>';

        busyDateItem.innerHTML = `
            <h4>${formattedDate}</h4>
            ${bookingsHtml}
        `;
        busyDatesList.appendChild(busyDateItem);
        console.log("renderBusyDates: Appended busyDateItem for:", formattedDate); // <-- ADD THIS
    });
    console.log("renderBusyDates: Finished rendering busy dates."); // <-- ADD THIS
}

async function handleLogout() {
    try {
        const response = await fetch('/api/admin/logout', { method: 'POST' });
        const data = await response.json();
        if (response.ok) {
            window.location.href = '/admin-login';
        } else {
            // Reverted to standard browser alert
            alert(data.message || 'Logout failed.');
        }
    } catch (error) {
        console.error('Logout error:', error);
        // Reverted to standard browser alert
        alert('An error occurred during logout.');
    }
}

async function clearAllBookings() {
    // Reverted to standard browser confirm dialog
    if (!confirm('WARNING: Are you absolutely sure you want to clear ALL bookings? This action cannot be undone.')) {
        return;
    }
    try {
        const response = await fetch('/api/admin/clear-all-bookings', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm_clear: true }) // Send confirmation
        });
        const data = await response.json();
        if (response.ok) {
            // Reverted to showMessage for inline display
            showMessage('adminMessage', data.message, 'success');
            fetchBookings();
            fetchDashboardStats();
            fetchBusyDates();
        } else {
            // Reverted to showMessage for inline display
            showMessage('adminMessage', data.message || 'Failed to clear bookings.', 'error');
        }
    } catch (error) {
        console.error('Error clearing bookings:', error);
        // Reverted to showMessage for inline display
        showMessage('adminMessage', 'An error occurred while clearing bookings.', 'error');
    }
}


// --- Admin Dashboard UI Logic (Tab Switching and Initial Load) ---
function setupAdminDashboardUI() {
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const adminSections = document.querySelectorAll('.admin-section');

    sidebarLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();

            sidebarLinks.forEach(l => l.classList.remove('active'));
            event.target.classList.add('active');

            const targetSectionId = event.target.dataset.section;

            adminSections.forEach(section => {
                section.style.display = 'none';
            });

            const targetSection = document.getElementById(targetSectionId);
            if (targetSection) {
                targetSection.style.display = 'block';
            }
            // Trigger data fetch for the newly active section if needed
            if (targetSectionId === 'bookings-management') {
                fetchBookings();
            } else if (targetSectionId === 'dashboard-overview') {
                fetchDashboardStats();
                fetchBookings(); // Fetch bookings for the list in dashboard view
                fetchBusyDates(); // Fetch busy dates for the list in dashboard view
            }
        });
    });

    // Ensure the default active section (Dashboard Overview) is displayed and data loaded
    const defaultActiveSection = document.querySelector('.admin-section.active');
    if (defaultActiveSection) {
        defaultActiveSection.style.display = 'block';
        fetchDashboardStats();
        fetchBookings();
        fetchBusyDates();
    }
}


// --- Event Listeners and Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    // Public pages
    if (window.location.pathname === '/') {
        fetchEventPackages();
    }

    const bookEventForm = document.getElementById('bookEventForm');
    if (bookEventForm) {
        // Populate package ID if selected from index page
        const selectedPackageId = sessionStorage.getItem('selectedPackageId');
        if (selectedPackageId) {
            const packageIdInput = document.getElementById('package_id');
            if (packageIdInput) {
                packageIdInput.value = selectedPackageId;
            }
        }
        bookEventForm.addEventListener('submit', handleBookingFormSubmit);
    }


    // Admin dashboard specific logic
    if (is_admin_dashboard_page()) {
        setupAdminDashboardUI(); // Call the UI setup function

        const bookingFilter = document.getElementById('booking-filter');
        if (bookingFilter) {
            bookingFilter.addEventListener('change', fetchBookings);
        }

        const refreshBtn = document.getElementById('refresh-data-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                fetchDashboardStats();
                fetchBookings();
                fetchBusyDates();
            });
        }

        const clearAllBtn = document.getElementById('clear-all-data-btn'); // Renamed to clear-all-bookings in app.py and JS
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', clearAllBookings);
        }

        const logoutBtn = document.getElementById('admin-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
    }
});