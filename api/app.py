# FileName: MultipleFiles/app.py
# FileContents:
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np
import os
from marshmallow import Schema, fields, validate, ValidationError
from datetime import datetime
import csv

app = Flask(__name__)

CORS(app)
@app.route("/")
def home():
    return jsonify({"message": "Hello from AgriPredict on Vercel!"})
# Define the expected order of columns for the input DataFrame
FEATURE_COLUMNS = [
    'Rainfall (mm)', 'Temperature (°C)', 'Arrival (Quintals)', 'Humidity (%)', 'Pesticide Used (litres/ha)',
    'Region_Karnataka', 'Region_Maharashtra', 'Region_Punjab', 'Region_Tamil Nadu', 'Region_Uttar Pradesh',
    'Crop_Onion', 'Crop_Potato', 'Crop_Rice', 'Crop_Tomato', 'Crop_Wheat',
    'Variety_HD-2967', 'Variety_Hybrid-1', 'Variety_Kufri Jyoti', 'Variety_Local Red', 'Variety_Nashik Red'
]

# Define allowed values for categorical features for validation
ALLOWED_REGIONS = ["Punjab", "Maharashtra", "Tamil Nadu", "Bihar", "Karnataka", "Uttar Pradesh"]
ALLOWED_CROPS = ["Wheat", "Onion", "Tomato", "Maize", "Potato", "Rice"]
ALLOWED_VARIETIES = [
    "HD-2967", "PBW-343", "WH-147", # Wheat
    "Nashik Red", "Pusa Red", "Agrifound Dark Red", # Onion
    "Local Red", "Pusa Ruby", "Hybrid Tomato", # Tomato
    "Hybrid-1", "PMH-1", "HQPM-1", # Maize
    "Kufri Jyoti", "Kufri Sindhuri", "Kufri Chandramukhi", # Potato
    "Basmati", "Pusa-1121", "Sona Masuri" # Rice
]

# Schema for prediction input validation
class PredictionInputSchema(Schema):
    region = fields.Str(required=True, validate=validate.OneOf(ALLOWED_REGIONS, error="Invalid region selected."))
    crop = fields.Str(required=True, validate=validate.OneOf(ALLOWED_CROPS, error="Invalid crop selected."))
    variety = fields.Str(required=True, validate=validate.OneOf(ALLOWED_VARIETIES, error="Invalid variety selected."))
    rainfall = fields.Float(required=True, validate=validate.Range(min=0.0, max=200.0, error="Rainfall must be between 0 and 200 mm."))
    temperature = fields.Float(required=True, validate=validate.Range(min=10.0, max=45.0, error="Temperature must be between 10 and 45 °C."))
    arrival = fields.Float(required=True, validate=validate.Range(min=0.0, max=5000.0, error="Arrival must be between 0 and 5000 Quintals."))
    humidity = fields.Float(required=True, validate=validate.Range(min=0.0, max=100.0, error="Humidity must be between 0 and 100 %."))
    pesticide = fields.Float(required=True, validate=validate.Range(min=0.0, max=10.0, error="Pesticide used must be between 0 and 10 litres/ha."))

# Schema for actual data submission validation
class ActualDataInputSchema(Schema):
    region = fields.Str(required=True, validate=validate.OneOf(ALLOWED_REGIONS, error="Invalid region selected."))
    crop = fields.Str(required=True, validate=validate.OneOf(ALLOWED_CROPS, error="Invalid crop selected."))
    variety = fields.Str(required=True, validate=validate.OneOf(ALLOWED_VARIETIES, error="Invalid variety selected."))
    rainfall = fields.Float(required=True, validate=validate.Range(min=0.0, max=200.0, error="Rainfall must be between 0 and 200 mm."))
    temperature = fields.Float(required=True, validate=validate.Range(min=10.0, max=45.0, error="Temperature must be between 10 and 45 °C."))
    arrival = fields.Float(required=True, validate=validate.Range(min=0.0, max=5000.0, error="Arrival must be between 0 and 5000 Quintals."))
    humidity = fields.Float(required=True, validate=validate.Range(min=0.0, max=100.0, error="Humidity must be between 0 and 100 %."))
    pesticide = fields.Float(required=True, validate=validate.Range(min=0.0, max=10.0, error="Pesticide used must be between 0 and 10 litres/ha."))
    min_price = fields.Float(required=True, validate=validate.Range(min=0.0, error="Min price must be non-negative."))
    max_price = fields.Float(required=True, validate=validate.Range(min=0.0, error="Max price must be non-negative."))
    modal_price = fields.Float(required=True, validate=validate.Range(min=0.0, error="Modal price must be non-negative."))


# Load the trained models and preprocessors
model_min, model_max, model_modal = None, None, None
scaler, poly_features = None, None

try:
    model_min = joblib.load("Min_Price_Predictor")
    model_max = joblib.load("Max_Price_Predictor")
    model_modal = joblib.load("Modal_Price_Predictor")
    scaler = joblib.load("scaler.pkl")
    poly_features = joblib.load("poly_features.pkl")
    print("Models and preprocessors loaded successfully!")
except FileNotFoundError:
    print("Error: One or more model/preprocessor files not found. Ensure they are in the same directory as app.py")
except Exception as e:
    print(f"Error loading models or preprocessors: {e}")

@app.route('/')
def serve_html():
    return send_from_directory('.', 'agri_price_predictor_spa.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json

    # Validate input data
    try:
        validated_data = PredictionInputSchema().load(data)
    except ValidationError as err:
        return jsonify({"error": "Validation Error", "messages": err.messages}), 400
    except Exception as e:
        return jsonify({"error": "Invalid request data format.", "details": str(e)}), 400

    # Create a DataFrame for the input, initialized with zeros
    input_df = pd.DataFrame(0, index=[0], columns=FEATURE_COLUMNS)

    # Populate numerical features
    input_df["Rainfall (mm)"] = validated_data["rainfall"]
    input_df["Temperature (°C)"] = validated_data["temperature"]
    input_df["Arrival (Quintals)"] = validated_data["arrival"]
    input_df["Humidity (%)"] = validated_data["humidity"]
    input_df["Pesticide Used (litres/ha)"] = validated_data["pesticide"]

    # Populate one-hot encoded categorical features
    region_col = f"Region_{validated_data['region']}"
    if region_col in input_df.columns:
        input_df[region_col] = 1

    crop_col = f"Crop_{validated_data['crop']}"
    if crop_col in input_df.columns:
        input_df[crop_col] = 1

    variety_col = f"Variety_{validated_data['variety']}"
    if variety_col in input_df.columns:
        input_col = f"Variety_{validated_data['variety']}"
        if variety_col in input_df.columns:
            input_df[variety_col] = 1
        else:
            # Handle cases where a variety might not be in FEATURE_COLUMNS
            # This could happen if a new variety is added to ALLOWED_VARIETIES
            # but the model was trained on an older set.
            # For now, we'll just print a warning. For production, you might
            # want a more robust strategy (e.g., re-train model, or map to 'Other').
            print(f"Warning: Variety '{validated_data['variety']}' not found in model features.")


    # Ensure the order of columns matches the training data
    input_df = input_df[FEATURE_COLUMNS]

    # Check if models are loaded
    if not all([model_min, model_max, model_modal, scaler, poly_features]):
        return jsonify({"error": "Prediction models are not loaded. Please check server logs."}), 500

    try:
        # Scale the input
        scaled_input = scaler.transform(input_df)

        # Apply polynomial features
        final_input = poly_features.transform(scaled_input)

        # Make predictions
        min_price = model_min.predict(final_input)[0]
        max_price = model_max.predict(final_input)[0]
        modal_price = model_modal.predict(final_input)[0]

        # Ensure prices are non-negative
        min_price = max(0, min_price)
        max_price = max(0, max_price)
        modal_price = max(0, modal_price)

        return jsonify({
            "min_price": round(min_price, 2),
            "max_price": round(max_price, 2),
            "modal_price": round(modal_price, 2)
        })
    except Exception as e:
        print(f"Prediction error: {e}")
        return jsonify({"error": "An error occurred during prediction. Please try again later.", "details": str(e)}), 500

@app.route('/submit_actual_data', methods=['POST'])
def submit_actual_data():
    data = request.json

    try:
        validated_data = ActualDataInputSchema().load(data)
    except ValidationError as err:
        return jsonify({"error": "Validation Error", "messages": err.messages}), 400
    except Exception as e:
        return jsonify({"error": "Invalid request data format.", "details": str(e)}), 400

    # --- Configuration for your main training CSV ---
    # IMPORTANT: Replace 'agri_crop_price_augmented_improved.csv' with your actual training data CSV filename.
    training_csv_file = 'agri_crop_price_augmented_improved.csv'
    # These headers MUST exactly match the columns in your training CSV, in order.
    # Do NOT include 'Timestamp' here unless your training CSV actually has it.
    training_csv_headers = [
        'Region', 'Crop', 'Variety', 'Rainfall (mm)', 'Temperature (°C)',
        'Arrival (Quintals)', 'Humidity (%)', 'Pesticide Used (litres/ha)',
        'Min Price (Rs/qtl)', 'Max Price (Rs/qtl)', 'Modal Price (Rs/qtl)'
    ]

    # --- Configuration for the separate log/actual data CSV (optional, but good for tracking) ---
    # This file will contain all submitted data, including a timestamp.
    log_csv_file = 'actual_market_data_log.csv'
    log_csv_headers = [
        'Timestamp', 'Region', 'Crop', 'Variety', 'Rainfall (mm)', 'Temperature (°C)',
        'Arrival (Quintals)', 'Humidity (%)', 'Pesticide Used (litres/ha)',
        'Min Price (Rs/qtl)', 'Max Price (Rs/qtl)', 'Modal Price (Rs/qtl)'
    ]

    # Prepare data row for the training CSV (no timestamp)
    training_row_data = [
        validated_data['region'],
        validated_data['crop'],
        validated_data['variety'],
        validated_data['rainfall'],
        validated_data['temperature'],
        validated_data['arrival'],
        validated_data['humidity'],
        validated_data['pesticide'],
        validated_data['min_price'],
        validated_data['max_price'],
        validated_data['modal_price']
    ]

    # Prepare data row for the log CSV (with timestamp)
    log_row_data = [
        datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        validated_data['region'],
        validated_data['crop'],
        validated_data['variety'],
        validated_data['rainfall'],
        validated_data['temperature'],
        validated_data['arrival'],
        validated_data['humidity'],
        validated_data['pesticide'],
        validated_data['min_price'],
        validated_data['max_price'],
        validated_data['modal_price']
    ]

    try:
        # --- Write to the main training CSV ---
        training_file_exists = os.path.exists(training_csv_file)
        with open(training_csv_file, 'a', newline='') as f:
            writer = csv.writer(f)
            if not training_file_exists:
                writer.writerow(training_csv_headers) # Write headers only if file is new
            writer.writerow(training_row_data)

        # --- Write to the separate log CSV ---
        log_file_exists = os.path.exists(log_csv_file)
        with open(log_csv_file, 'a', newline='') as f_log:
            writer_log = csv.writer(f_log)
            if not log_file_exists:
                writer_log.writerow(log_csv_headers) # Write headers only if file is new
            writer_log.writerow(log_row_data)

        return jsonify({"message": "Data submitted successfully to CSVs!"}), 200
    except Exception as e:
        print(f"Error saving CSV file(s): {e}")
        return jsonify({"error": "Failed to save data to CSV file(s).", "details": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)


