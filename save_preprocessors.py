import pandas as pd
import numpy as np
from sklearn import model_selection as MS
from sklearn.preprocessing import StandardScaler as SS
from sklearn.preprocessing import PolynomialFeatures as PF
import joblib

# Load your dataset
df = pd.read_csv("agri_crop_price_augmented_improved.csv")

# One-hot encode categorical variables
DF = pd.get_dummies(df, columns=["Region", "Crop", "Variety"], drop_first=True)

# Define features and target variables
X = DF.drop(["Min Price (Rs/qtl)", "Max Price (Rs/qtl)", "Modal Price (Rs/qtl)"], axis=1)
Y1 = DF["Min Price (Rs/qtl)"]
Y2 = DF["Max Price (Rs/qtl)"]
Y3 = DF["Modal Price (Rs/qtl)"]

# Split the data into training and testing sets
X_train, X_test, Y1_train, Y1_test = MS.train_test_split(X, Y1, test_size=0.3, random_state=50)

# Initialize and fit the scaler
scaler = SS()
X_train_scaled = scaler.fit_transform(X_train)

# Initialize and fit polynomial features
poly = PF(degree=2, include_bias=False)
X_train_poly = poly.fit_transform(X_train_scaled)

# Save the fitted scaler and polynomial features
joblib.dump(scaler, "scaler.pkl")
joblib.dump(poly, "poly_features.pkl")

print("Scaler and PolynomialFeatures objects saved successfully!")
