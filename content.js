// content.js - fixed regular expression issue
(() => {
  // Configuration
  let isNavigating = false;
  let currentDateIndex = 0;
  let datesToProcess = [];

  // Main function to extract meal data
  function extractMealData() {
    // Check if we're on a page with meal data
    if (!document.getElementById("cuerpo_resumen")) {
      console.log("No meal data found on this page");
      return;
    }

    // Extract the date from the first row
    const dateRow = document.querySelector("#cuerpo_resumen tr");
    if (!dateRow) return;

    const dateText = dateRow.textContent.trim();
    console.log("dateText", dateText);

    const dateMatch = dateText.match(
      /([A-Za-z]+), *(\d+) *([A-Za-z]+) *(\d{4})/
    );
    if (!dateMatch) return;

    console.log("date-matched", dateMatch);

    const date = `${dateMatch[2]} ${dateMatch[3]} ${dateMatch[4]}`;
    console.log(`Extracting data for: ${date}`);

    const mealData = {
      date: date,
      meals: {},
    };

    // Current meal type being processed
    let currentMeal = "";

    // Process each row in the table
    const rows = document.querySelectorAll("#cuerpo_resumen tr");
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const text = row.textContent.trim();

      // Check if this is a meal header row
      if (
        row.querySelector(
          'td[colspan="3"][style*="background-color: #e7e6e6;"]'
        )
      ) {
        currentMeal = text.replace(/^\s*|\s*$/g, "");
        if (!["Breakfast", "Lunch", "Dinner"].includes(currentMeal)) {
          currentMeal = "";
        }
        continue;
      }

      // Skip if we're not in a valid meal section
      if (!currentMeal) continue;

      // Check if this row has meal option data
      if (row.querySelector('td[colspan="2"][onclick*="toggle"]')) {
        const option = row.querySelector('td[colspan="2"]').textContent.trim();

        console.log(option)

        // Fixed: Properly extract the details ID from the onclick attribute
        const onclickAttr = row
          .querySelector('td[colspan="2"]')
          .getAttribute("onclick");
        const detailsIdMatch = onclickAttr.match(/\$\("#([^"]+)"\)/);

        if (detailsIdMatch && detailsIdMatch[1]) {
          const detailsId = detailsIdMatch[1];
          const detailsElement = document.getElementById(detailsId);

          if (detailsElement) {
            // Extract each person and their diet info
            const peopleText = detailsElement.innerHTML;

            const people = peopleText.split("<br>");

            people.forEach((person) => {
              // Extract name and diet info
              const match = person.trim().match(/^(.+?)(?:\s*\((.+?)\))?$/);
              if (match) {
                const name = match[1].trim();
                const diet = match[2] || "";

                // Categorize this as accepted or declined based on option
                const status = option.toLowerCase().includes("no") && !option.toLowerCase().includes("normal")
                  ? "declined"
                  : "accepted";

                const mealOption = !option.toLowerCase().includes("normal") ? option.replace(/NO/i, "").trim() :  option;

                // Initialize person data if needed
                if (!mealData.meals[name]) {
                  mealData.meals[name] = {};
                }

                // Store the meal choice for this person
                mealData.meals[name][currentMeal] = {
                  status: status,
                  option: mealOption,
                  diet: diet,
                };
              }
            });

            console.log(mealData);
          }
        }
      }
    }

    // Save the extracted data
    saveMealData(date, mealData);

    // If we're in navigation mode, continue to the next date
    if (isNavigating && currentDateIndex < datesToProcess.length - 1) {
      currentDateIndex++;
      setTimeout(navigateToDate, 1000);
    } else if (isNavigating) {
      // We've finished processing all dates
      isNavigating = false;
      currentDateIndex = 0;
      showNavigationStatus(
        "Navigation complete! Processed " + datesToProcess.length + " days."
      );
    }
  }

  // Function to save the extracted data to extension storage
  function saveMealData(date, data) {
    chrome.storage.local.get(["mealData"], (result) => {
      const allData = result.mealData || {};
      allData[date] = data;

      chrome.storage.local.set({ mealData: allData }, () => {
        console.log(`Data saved for ${date}`);
        if (isNavigating) {
          showNavigationStatus(
            `Saved data for ${date} (${currentDateIndex + 1}/${
              datesToProcess.length
            })`
          );
        }
      });
    });
  }

  // Function to navigate to a specific date
  function navigateToDate() {
    if (!isNavigating || currentDateIndex >= datesToProcess.length) {
      return;
    }

    const date = datesToProcess[currentDateIndex];
    console.log(`Navigating to date: ${date}`);
    showNavigationStatus(
      `Navigating to ${date} (${currentDateIndex + 1}/${
        datesToProcess.length
      })...`
    );

    // Find the navigation controls and change the date
    // This will need to be adapted to match your specific booking system's date navigation

    // Look for date input fields
    const dateInputs = document.querySelectorAll('input[type="date"]');
    if (dateInputs.length > 0) {
      // Assume the first date input is the one we want
      const dateInput = dateInputs[0];

      // Format the date as YYYY-MM-DD for the input
      const [day, month, year] = date.split(" ");
      const monthNumber = getMonthNumber(month);
      const formattedDate = `${year}-${monthNumber}-${day.padStart(2, "0")}`;

      // Set the date value
      dateInput.value = formattedDate;

      // Trigger change and input events to ensure the system recognizes the change
      dateInput.dispatchEvent(new Event("input", { bubbles: true }));
      dateInput.dispatchEvent(new Event("change", { bubbles: true }));

      // Look for a submit or search button
      const buttons = Array.from(
        document.querySelectorAll('button, input[type="submit"]')
      );
      const searchButton = buttons.find(
        (button) =>
          button.textContent.toLowerCase().includes("search") ||
          button.textContent.toLowerCase().includes("go") ||
          button.value?.toLowerCase().includes("search")
      );

      if (searchButton) {
        searchButton.click();
      } else {
        // If no button found, try to submit the form
        const form = dateInput.closest("form");
        if (form) {
          form.submit();
        }
      }
    } else {
      // If no date input found, look for next/previous day buttons and calendar widgets
      // This is a more complex approach and would need customization for your specific system
      // For now, we'll show an error
      showNavigationStatus(
        "Could not find date navigation controls. Please navigate manually.",
        true
      );
      isNavigating = false;
    }
  }

  // Helper function to get month number from name
  function getMonthNumber(monthName) {
    const months = {
      January: "01",
      February: "02",
      March: "03",
      April: "04",
      May: "05",
      June: "06",
      July: "07",
      August: "08",
      September: "09",
      October: "10",
      November: "11",
      December: "12",
    };
    return months[monthName] || "01";
  }

  // Generate an array of dates for a full month
  function generateDatesForMonth(year, month) {
    const dates = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthName = new Date(year, month - 1, 1).toLocaleString("default", {
      month: "long",
    });

    for (let day = 1; day <= daysInMonth; day++) {
      dates.push(`${day} ${monthName} ${year}`);
    }

    return dates;
  }

  // Function to start navigation for a month
  function startMonthNavigation(year, month) {
    if (isNavigating) {
      showNavigationStatus(
        "Already navigating. Please wait until it completes.",
        true
      );
      return;
    }

    datesToProcess = generateDatesForMonth(year, month);
    currentDateIndex = 0;
    isNavigating = true;

    showNavigationStatus(
      `Starting navigation for ${datesToProcess.length} days in ${new Date(
        year,
        month - 1,
        1
      ).toLocaleString("default", { month: "long" })} ${year}`
    );

    // Start the navigation process
    navigateToDate();
  }

  // UI for navigation status
  function showNavigationStatus(message, isError = false) {
    let statusDiv = document.getElementById("meal-extension-status");

    if (!statusDiv) {
      statusDiv = document.createElement("div");
      statusDiv.id = "meal-extension-status";
      statusDiv.style.position = "fixed";
      statusDiv.style.bottom = "70px";
      statusDiv.style.right = "20px";
      statusDiv.style.zIndex = "9999";
      statusDiv.style.padding = "10px";
      statusDiv.style.borderRadius = "5px";
      statusDiv.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
      statusDiv.style.maxWidth = "300px";
      document.body.appendChild(statusDiv);
    }

    statusDiv.style.backgroundColor = isError ? "#ffecec" : "#e8f4f8";
    statusDiv.style.border = isError
      ? "1px solid #f5aca6"
      : "1px solid #a8d1df";
    statusDiv.textContent = message;

    // Clear the message after a few seconds if it's an error
    if (isError) {
      setTimeout(() => {
        statusDiv.textContent = "";
        statusDiv.style.backgroundColor = "transparent";
        statusDiv.style.border = "none";
      }, 5000);
    }
  }

  // Create control panel for the extension
  function createControlPanel() {
    const panel = document.createElement("div");
    panel.id = "meal-extension-panel";
    panel.style.position = "fixed";
    panel.style.bottom = "20px";
    panel.style.right = "20px";
    panel.style.zIndex = "9999";
    panel.style.padding = "10px";
    panel.style.backgroundColor = "#f0f0f0";
    panel.style.border = "1px solid #ccc";
    panel.style.borderRadius = "5px";
    panel.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";

    panel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">Meal Booking Analyzer</div>
      <div style="margin-bottom: 10px;">
        <label for="month-select">Month:</label>
        <select id="month-select" style="margin-right: 5px;">
          ${Array.from({ length: 12 }, (_, i) => {
            const month = new Date(0, i).toLocaleString("default", {
              month: "long",
            });
            return `<option value="${i + 1}">${month}</option>`;
          }).join("")}
        </select>
        
        <label for="year-select">Year:</label>
        <select id="year-select">
          ${Array.from({ length: 5 }, (_, i) => {
            const year = new Date().getFullYear() - 2 + i;
            return `<option value="${year}" ${
              year === new Date().getFullYear() ? "selected" : ""
            }>${year}</option>`;
          }).join("")}
        </select>
      </div>
      
      <button id="start-navigation" style="margin-right: 5px; padding: 5px 10px; background-color: #4285f4; color: white; border: none; border-radius: 3px; cursor: pointer;">
        Process Month
      </button>
      
      <button id="extract-current" style="margin-right: 5px; padding: 5px 10px; background-color: #34a853; color: white; border: none; border-radius: 3px; cursor: pointer;">
        Extract Current Day
      </button>
      
      <button id="view-data" style="padding: 5px 10px; background-color: #fbbc05; color: white; border: none; border-radius: 3px; cursor: pointer;">
        View Data
      </button>
    `;

    document.body.appendChild(panel);

    // Set default month to current month
    document.getElementById("month-select").value = new Date().getMonth() + 1;

    // Add event listeners
    document
      .getElementById("start-navigation")
      .addEventListener("click", () => {
        const year = parseInt(document.getElementById("year-select").value);
        const month = parseInt(document.getElementById("month-select").value);
        startMonthNavigation(year, month);
      });

    document
      .getElementById("extract-current")
      .addEventListener("click", extractMealData);

    document.getElementById("view-data").addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "openPopup" });
    });
  }

  // Run extraction when the page loads
  window.addEventListener("load", () => {
    // Wait a bit for any AJAX content to load
    setTimeout(() => {
      extractMealData();
      createControlPanel();
    }, 1000);
  });

  // Also listen for XHR responses that might indicate new data is loaded
  const originalXHR = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function () {
    this.addEventListener("load", function () {
      // Wait a bit after XHR completes for DOM to update
      setTimeout(extractMealData, 500);
    });
    originalXHR.apply(this, arguments);
  };
})();
