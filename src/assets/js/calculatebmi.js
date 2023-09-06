function calculateBMI(event) {
    event.preventDefault();
    // Get the input values
    var age = parseInt(document.getElementById("age").value);
    var gender = document.getElementById("gender").value;
    var height = parseFloat(document.getElementById("height").value);
    var weight = parseFloat(document.getElementById("weight").value);
  
    // Check if height and weight are valid numbers
    if (isNaN(height) || isNaN(weight) || height <= 0 || weight <= 0) {
      alert("Please enter valid height and weight.");
      return;
    }
  
    // Calculate BMI
    var heightInMeters = height / 100; // Convert height to meters
    var bmi = weight / (heightInMeters * heightInMeters);

    // Display the BMI
    var resultElement = document.getElementById("result");
    resultElement.innerHTML = "Your BMI is: " + bmi.toFixed(2);
  
    // Determine the BMI category based on gender
    var category;
    if (gender === "male") {
      if (bmi < 18.5) {
        category = "Underweight";
      } else if (bmi >= 18.5 && bmi < 24.9) {
        category = "Normal weight";
      } else if (bmi >= 25 && bmi < 29.9) {
        category = "Overweight";
      } else {
        category = "Obese";
      }
    } else if (gender === "female") {
      if (bmi < 18.5) {
        category = "Underweight";
      } else if (bmi >= 18.5 && bmi < 24.9) {
        category = "Normal weight";
      } else if (bmi >= 25 && bmi < 29.9) {
        category = "Overweight";
      } else {
        category = "Obese";
      }
    }

    // Display the category
    var categoryElement = document.getElementById("result-category");
    categoryElement.innerHTML = "BMI Category: " + category;
  }
  