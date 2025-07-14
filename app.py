from flask import Flask, request, jsonify, render_template, redirect, url_for, session
import mysql.connector
import json
from dotenv import load_dotenv
import os
from datetime import datetime, date
import traceback
from functools import wraps # Added explicitly for decorator

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.getenv('SECRET_KEY', 'a_very_secret_key_that_should_be_random')

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_DATABASE')
}

def get_db_connection():
    """Establishes and returns a database connection."""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except mysql.connector.Error as err:
        print(f"Database connection error: {err}")
        return None

# --- Helper Functions ---

def is_admin_logged_in():
    """Checks if the current session is an admin."""
    return 'user_id' in session and session.get('role') == 'admin'

# Decorator for admin login required
def admin_login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not is_admin_logged_in():
            return jsonify({'message': 'Unauthorized. Admin login required.'}), 401
        return f(*args, **kwargs)
    return decorated_function

# --- Public Page Routes ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/book-event')
def book_event_page():
    return render_template('book-event.html')

@app.route('/admin-login')
def admin_login_page():
    if is_admin_logged_in():
        return redirect(url_for('admin_dashboard'))
    return render_template('admin_login.html')

@app.route('/admin-dashboard')
def admin_dashboard():
    if not is_admin_logged_in():
        return redirect(url_for('admin_login_page'))
    return render_template('admin_dashboard.html')


@app.route('/api/event-packages', methods=['GET'])
def get_event_packages():
    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database connection error'}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM event_packages")
        packages = cursor.fetchall()
        for p in packages:
            if 'what_included' in p and isinstance(p['what_included'], str):
                try:
                    p['what_included'] = json.loads(p['what_included'])
                except json.JSONDecodeError:
                    p['what_included'] = [] # Fallback to empty list if JSON parsing fails
        return jsonify(packages)
    except mysql.connector.Error as err:
        print(f"Database error fetching event packages: {err}")
        return jsonify({'message': f'Database error: {err}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/book-event', methods=['POST'])
def create_booking():
    data = request.get_json()

    required_fields = ['package_id', 'full_name', 'phone_number', 'email_address', 'preferred_date', 'location']
    if not all(data.get(field) for field in required_fields):
        return jsonify({'message': 'Missing required fields'}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database connection error'}), 500

    cursor = conn.cursor()
    try:
        query = """
        INSERT INTO bookings (package_id, full_name, phone_number, email_address, preferred_date, location, expected_guests, additional_requirements)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (
            data['package_id'],
            data['full_name'],
            data['phone_number'],
            data['email_address'],
            data['preferred_date'],
            data['location'],
            data.get('expected_guests'),
            data.get('additional_requirements')
        ))
        conn.commit()
        return jsonify({'message': 'Booking request submitted successfully!', 'booking_id': cursor.lastrowid}), 201
    except mysql.connector.Error as err:
        conn.rollback()
        print(f"Database error creating booking: {err}")
        return jsonify({'message': f'Database error: {err}'}), 500
    finally:
        cursor.close()
        conn.close()

# --- Admin Authentication ---

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    username, password = data.get('username'), data.get('password')

    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database connection error'}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT user_id, username, password_hash, role FROM users WHERE username = %s AND role = 'admin'",
            (username,)
        )
        user = cursor.fetchone()

        if user and user['password_hash'] == password: # In a real app, use a strong hashing like bcrypt
            session.update({
                'user_id': user['user_id'],
                'username': user['username'],
                'role': user['role']
            })
            return jsonify({'message': 'Login successful', 'redirect_url': url_for('admin_dashboard')}), 200
        else:
            return jsonify({'message': 'Invalid credentials or not an admin'}), 401
    except mysql.connector.Error as err:
        print(f"Database error during admin login: {err}")
        return jsonify({'message': f'Database error: {err}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully', 'redirect_url': url_for('admin_login_page')}), 200

# --- Admin Dashboard API Endpoints ---

@app.route('/api/admin/stats', methods=['GET'])
@admin_login_required
def fetchDashboardStats():
    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database connection error'}), 500

    cursor = conn.cursor()
    try:
        stats = {}
        # Fetch total bookings
        cursor.execute("SELECT COUNT(*) FROM bookings")
        stats['total_bookings'] = cursor.fetchone()[0]

        # Fetch counts for specific statuses
        for status in ['Pending Review', 'Confirmed', 'Rejected']:
            query = "SELECT COUNT(*) FROM bookings WHERE status = %s"
            cursor.execute(query, (status,))
            stats_key = status.lower().replace(' ', '_')
            stats[stats_key] = cursor.fetchone()[0]

        return jsonify(stats), 200
    except mysql.connector.Error as err:
        print(f"Database error fetching dashboard stats: {err}")
        return jsonify({'message': f'Database error: {err}'}), 500
    finally:
        cursor.close()
        conn.close()
        
@app.route('/api/admin/bookings', methods=['GET'])
@admin_login_required
def get_all_bookings_admin():
    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database connection error'}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        status_filter = request.args.get('status')
        query = """
        SELECT b.booking_id, b.package_id, b.full_name, b.phone_number, b.email_address,
               b.preferred_date, b.location, b.expected_guests, b.additional_requirements,
               b.status, b.booking_date, ep.package_name 
        FROM bookings b
        JOIN event_packages ep ON b.package_id = ep.package_id
        """
        params = []

        if status_filter and status_filter != 'All':
            query += " WHERE b.status = %s"
            params.append(status_filter)

        query += " ORDER BY b.booking_date DESC"

        cursor.execute(query, tuple(params))
        bookings = cursor.fetchall()

        for b in bookings:
            if b.get('preferred_date'):
                b['preferred_date'] = b['preferred_date'].strftime('%Y-%m-%d')
            if b.get('booking_date'):
                b['booking_date'] = b['booking_date'].strftime('%Y-%m-%d %H:%M:%S')

        return jsonify(bookings), 200
    except mysql.connector.Error as err:
        print(f"Database error fetching bookings: {err}")
        traceback.print_exc() # Print full traceback for this error
        return jsonify({'message': f'Database error: {err}'}), 500
    finally:
        cursor.close()
        conn.close()

# In your app.py, find the @app.route('/api/admin/bookings/<int:booking_id>/status', methods=['PUT'])

@app.route('/api/admin/bookings/<int:booking_id>/status', methods=['PUT'])
@admin_login_required
def update_booking_status(booking_id):
    print(f"--- update_booking_status route hit for booking ID: {booking_id} ---")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        data = request.get_json()
        print(f"Received JSON data: {data}")

        if not data or 'status' not in data:
            print("Error: Missing 'status' in JSON data.")
            return jsonify({'message': 'Invalid request: status field is required.'}), 400

        new_status = data.get('status')

        if new_status not in ['Pending Review', 'Confirmed', 'Rejected']:
            print(f"Error: Invalid status provided: {new_status}")
            return jsonify({'message': 'Invalid status provided'}), 400

        # --- IMPORTANT: Get current status and preferred_date BEFORE updating ---
        cursor.execute("SELECT preferred_date, status FROM bookings WHERE booking_id = %s", (booking_id,))
        existing_booking_info = cursor.fetchone()
        if existing_booking_info is None:
            print(f"Error: Booking ID {booking_id} not found.")
            return jsonify({'message': 'Booking not found'}), 404

        preferred_date_from_db, old_status = existing_booking_info
        # Ensure preferred_date_from_db is a date object for comparison
        if isinstance(preferred_date_from_db, str):
            try:
                preferred_date_from_db = datetime.strptime(preferred_date_from_db, '%Y-%m-%d').date()
            except ValueError:
                pass # Will be handled by the later isinstance check if it's still a string

        # Update status in the database
        cursor.execute(
            "UPDATE bookings SET status = %s WHERE booking_id = %s",
            (new_status, booking_id) # Use booking_id directly
        )
        conn.commit()
        print(f"Booking {booking_id} status updated to {new_status} in DB.")

        # --- Logic for busy_dates update ---

        # Case 1: Booking is Confirmed (or re-confirmed)
        if new_status == 'Confirmed':
            print(f"Booking {booking_id} confirmed. Adding/updating busy date: {preferred_date_from_db}")
            booking_date_str = preferred_date_from_db.isoformat() if isinstance(preferred_date_from_db, date) else str(preferred_date_from_db)

            cursor.execute(
                "INSERT INTO busy_dates (date) VALUES (%s) ON DUPLICATE KEY UPDATE date = VALUES(date)",
                (booking_date_str,)
            )
            conn.commit()
            print("Busy date added/updated in DB for Confirmed status.")

        # Case 2: Booking changes FROM Confirmed to Rejected/Pending Review
        # We need to check if this date should now be removed from busy_dates
        if old_status == 'Confirmed' and new_status != 'Confirmed':
            print(f"Booking {booking_id} status changed from Confirmed to {new_status}.")
            booking_date_str = preferred_date_from_db.isoformat() if isinstance(preferred_date_from_db, date) else str(preferred_date_from_db)

            # Check if there are ANY other confirmed bookings for this date
            cursor.execute(
                "SELECT COUNT(*) FROM bookings WHERE preferred_date = %s AND status = 'Confirmed'",
                (booking_date_str,)
            )
            remaining_confirmed_on_date = cursor.fetchone()[0]
            print(f"Remaining confirmed bookings for {booking_date_str}: {remaining_confirmed_on_date}")

            if remaining_confirmed_on_date == 0:
                # No other confirmed bookings for this date, so remove it from busy_dates
                cursor.execute("DELETE FROM busy_dates WHERE date = %s", (booking_date_str,))
                conn.commit()
                print(f"Removed {booking_date_str} from busy_dates as no other confirmed bookings exist.")
            else:
                print(f"Date {booking_date_str} remains in busy_dates because {remaining_confirmed_on_date} other confirmed bookings exist.")


        return jsonify({'message': f'Booking {booking_id} status updated to {new_status}.'}), 200

    except Exception as e:
        conn.rollback()
        print(f"--- Server Error updating booking status for {booking_id}: {e} ---")
        traceback.print_exc()
        return jsonify({'message': 'An internal server error occurred while updating booking status.'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/bookings/<int:booking_id>', methods=['DELETE'])
@admin_login_required
def delete_booking(booking_id):
    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database connection error'}), 500

    cursor = conn.cursor()
    try:
        # Before deleting, check if this booking was confirmed and if its date should be removed from busy_dates
        cursor.execute("SELECT preferred_date, status FROM bookings WHERE booking_id = %s", (booking_id,))
        booking_info = cursor.fetchone()
        
        cursor.execute("DELETE FROM bookings WHERE booking_id = %s", (booking_id,))
        conn.commit()

        if cursor.rowcount == 0:
            return jsonify({'message': 'Booking not found'}), 404
        
        # If the deleted booking was confirmed, check if any other confirmed bookings exist for that date
        if booking_info and booking_info[1] == 'Confirmed':
            deleted_date = booking_info[0]
            if isinstance(deleted_date, date):
                deleted_date_str = deleted_date.isoformat()
            else:
                try:
                    deleted_date_str = datetime.strptime(str(deleted_date), '%Y-%m-%d').isoformat()
                except ValueError:
                    deleted_date_str = str(deleted_date)
            
            cursor.execute("SELECT COUNT(*) FROM bookings WHERE preferred_date = %s AND status = 'Confirmed'", (deleted_date_str,))
            remaining_confirmed_on_date = cursor.fetchone()[0]

            if remaining_confirmed_on_date == 0:
                cursor.execute("DELETE FROM busy_dates WHERE date = %s", (deleted_date_str,))
                conn.commit()
                print(f"Removed {deleted_date_str} from busy_dates as no other confirmed bookings exist.")


        return jsonify({'message': 'Booking deleted successfully'}), 200
    except mysql.connector.Error as err:
        conn.rollback()
        print(f"Database error deleting booking: {err}")
        return jsonify({'message': f'Database error: {err}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/busy-dates', methods=['GET'])
@admin_login_required
def get_busy_dates():
    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database connection error'}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT date FROM busy_dates ORDER BY date ASC
        """)
        busy_dates_from_db = cursor.fetchall()
        
        result = []
        for entry in busy_dates_from_db:
            date_str = entry['date'].strftime('%Y-%m-%d')
            cursor.execute("""
                SELECT b.full_name, ep.package_name
                FROM bookings b
                JOIN event_packages ep ON b.package_id = ep.package_id
                WHERE b.preferred_date = %s AND b.status = 'Confirmed'
                ORDER BY b.booking_date ASC
            """, (date_str,))
            bookings_for_date = cursor.fetchall()
            
            result.append({
                'date': date_str,
                'bookings': bookings_for_date
            })

        return jsonify(result), 200
    except mysql.connector.Error as err:
        print(f"Database error fetching busy dates: {err}")
        traceback.print_exc() # Print full traceback for this error
        return jsonify({'message': f'Database error: {err}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/clear-all-bookings', methods=['DELETE'])
@admin_login_required
def clear_all_bookings():
    
    data = request.get_json()
    if not data or not data.get('confirm_clear', False):
        return jsonify({'message': 'Confirmation required to clear all bookings.'}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database connection error'}), 500

    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM bookings")
        cursor.execute("DELETE FROM busy_dates") # Clear busy dates as well
        conn.commit()
        return jsonify({'message': 'All bookings and busy dates cleared successfully'}), 200
    except mysql.connector.Error as err:
        conn.rollback()
        print(f"Database error clearing all bookings: {err}")
        traceback.print_exc() # Print full traceback for this error
        return jsonify({'message': f'Database error: {err}'}), 500
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)