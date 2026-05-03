# AgriWater OS 🌱💧

AgriWater OS is a Comprehensive Farm Planning Dashboard and "Digital Twin" for agricultural land[cite: 2]. It leverages real-time climate data, soil geochemistry proxies, and machine learning to deliver precision agriculture insights—without the need for expensive on-site hardware sensors[cite: 2]. 

By analyzing coordinates via an interactive map, the OS evaluates atmospheric conditions, tracks soil moisture, models historical climate data, and predicts optimal crop choices using a localized Machine Learning engine[cite: 1, 2].

## 🚀 Core Features

*   **GIS Topography Mapping:** Interactive mapping using Leaflet, featuring both High-Res Satellite (Esri) and Dark Terrain (CARTO) layers[cite: 1].
*   **Live Atmospheric Conditions:** Fetches real-time air temperature, solar radiation, wind speed, and humidity via the Open-Meteo API[cite: 1, 2].
*   **Daily Irrigation Planner:** Calculates a 24-hour water deficit by comparing Evapotranspiration (ET₀) and precipitation, while tracking volumetric soil moisture for shallow, medium, and deep-rooted crops[cite: 1, 2].
*   **Pollination & Spraying AI:** Uses wind speed, temperature, and rain data to dynamically output safety badges for chemical spraying and bee foraging activity[cite: 1, 2].
*   **Geochemical & Conservation Proxy:** Estimates soil pH, NPK capacity, and Land Surface Temperature (LST) based on historical leaching and thermal breakdown[cite: 1, 2]. Calculates erosion risk based on elevation (slope proxy) and intense rainfall[cite: 1, 2].
*   **Historical Analytics Hub:** Generates interactive Chart.js graphs displaying hydrographs (Rain vs. ET₀), erosion risk indices, 12-month climate trends, and simulated local market demand[cite: 1, 2].
*   **KNN Machine Learning Crop Matcher:** An in-browser K-Nearest Neighbors (KNN) algorithm that cross-references farm data against a 2,200-row dataset (`Crop_recommendation.csv`) across 7 dimensions (N, P, K, Temp, Humidity, pH, Rainfall) to predict top crop matches[cite: 1, 2].
*   **Developer & Export Hub:** Allows users to download session analytics as a JSON payload or export historical daily climate arrays as a CSV file[cite: 1, 2].

## 🛠️ Tech Stack

*   **Frontend:** HTML5, CSS3 (Glassmorphism UI), Vanilla JavaScript[cite: 1, 2, 3].
*   **Mapping:** Leaflet.js[cite: 2].
*   **Data Visualization:** Chart.js[cite: 2].
*   **Data Parsing:** PapaParse (for reading `Crop_recommendation.csv` client-side)[cite: 2].
*   **APIs:** Open-Meteo (Real-time and Historical Archive), Nominatim (OpenStreetMap Geocoding)[cite: 1, 2].

## 💻 Installation & Setup

Because this project fetches a local dataset (`Crop_recommendation.csv`) via the Fetch API/PapaParse, it cannot be run directly from the file system (`file://` protocol) due to browser CORS security restrictions[cite: 1]. 

1.  Clone the repository to your local machine.
2.  Ensure `Crop_recommendation.csv` is located in the root directory alongside `index.html`, `style.css`, and `app.js`[cite: 1].
3.  Serve the directory using a local web server. Examples:
    *   **VS Code:** Install and use the "Live Server" extension.
    *   **Python:** Run `python -m http.server 8000` in the terminal.
    *   **Node.js:** Run `npx serve`.
4.  Open your browser and navigate to `http://localhost:8000`.

## 🌍 General Use Cases

*   **Precision Irrigation Management:** Farm managers can prevent overwatering and crop stress by monitoring the exact daily water balance and receiving automated "Wait" or "Irrigate Immediately" recommendations[cite: 1, 2].
*   **Chemical Application Scheduling:** Agronomists can use the Pollination & Spraying AI to find optimal weather windows, avoiding chemical drift during high winds or runoff during rain[cite: 1].
*   **Sustainable Crop Selection:** Landowners looking to transition their fields can use the KNN Machine Learning engine to discover matching cash crops based on historical climate baselines rather than guesswork[cite: 1, 2].
*   **Erosion Control Planning:** Farm consultants can assess topography through the slope proxy tool to recommend essential contour farming, strip cropping, or no-till practices on high-risk terrain[cite: 1].

## 🎓 For Students and Researchers

AgriWater OS is designed to be highly transparent, making it an excellent sandbox for academic and research applications.

### 1. Data Science & Machine Learning Education
Students learning machine learning can study the `CropKNN` class in `app.js`[cite: 1]. Unlike "black box" API calls, this system runs a mathematical K-Nearest Neighbors engine entirely in Vanilla JavaScript[cite: 1]. 
*   **How to use:** Students can inspect how the 7 variables (N, P, K, Temperature, Humidity, pH, Rainfall) from `Crop_recommendation.csv` are normalized and calculated via Euclidean distance to yield confidence percentages[cite: 1]. They can modify the `k` value, tweak the distance weighting, or update the CSV to see real-time UI changes.

### 2. Agro-Climatology Research
Researchers studying the effects of climate on agriculture can bypass complex API scripting by using the OS as a graphical interface for Open-Meteo data[cite: 1].
*   **How to use:** Navigate the map to a specific global coordinate and set the time range filter (e.g., Past 1 Year)[cite: 1, 2]. Use the **Developer & Export Hub** to immediately download a cleanly formatted `agriwater_historical.csv` containing daily maximum temperatures, minimum temperatures, rainfall, and ET₀ sums for immediate import into Python, R, or Excel[cite: 1, 2].

### 3. Soil and Geospatial Studies
Students in agronomy can explore the "Weathering Proxy Model" logic used in the geochemical pipeline[cite: 1].
*   **How to use:** By analyzing how the dashboard dynamically alters assumed soil pH and NPK capacity based on historical rainfall (e.g., >1500mm indicating highly leached acidic soil vs. <500mm indicating arid alkaline soil), students can test their geospatial understanding of how long-term weather shapes soil typologies[cite: 1].
