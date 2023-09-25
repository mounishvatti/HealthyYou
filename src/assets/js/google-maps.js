'use strict';

/** Hides a DOM element and optionally focuses on focusEl. */
function hideElement(el, focusEl) {
  el.style.display = 'none';
  if (focusEl) focusEl.focus();
}

/** Shows a DOM element that has been hidden and optionally focuses on focusEl. */
function showElement(el, focusEl) {
  el.style.display = 'block';
  if (focusEl) focusEl.focus();
}

/** Determines if a DOM element contains content that cannot be scrolled into view. */
function hasHiddenContent(el) {
  const noscroll = window.getComputedStyle(el).overflowY.includes('hidden');
  return noscroll && el.scrollHeight > el.clientHeight;
}

/** Format a Place Type string by capitalizing and replacing underscores with spaces. */
function formatPlaceType(str) {
  const capitalized = str.charAt(0).toUpperCase() + str.slice(1);
  return capitalized.replace(/_/g, ' ');
}

/** Initializes an array of zeros with the given size. */
function initArray(arraySize) {
  const array = [];
  while (array.length < arraySize) {
    array.push(0);
  }
  return array;
}

/** Assigns star icons to an object given its rating (out of 5). */
function addStarIcons(obj) {
  if (!obj.rating) return;
  const starsOutOfTen = Math.round(2 * obj.rating);
  const fullStars = Math.floor(starsOutOfTen / 2);
  const halfStars = fullStars !== starsOutOfTen / 2 ? 1 : 0;
  const emptyStars = 5 - fullStars - halfStars;

  // Express stars as arrays to make iterating in Handlebars easy.
  obj.fullStarIcons = initArray(fullStars);
  obj.halfStarIcons = initArray(halfStars);
  obj.emptyStarIcons = initArray(emptyStars);
}

/**
 * Constructs an array of opening hours by day from a PlaceOpeningHours object,
 * where adjacent days of week with the same hours are collapsed into one element.
 */
function parseDaysHours(openingHours) {
  const daysHours = openingHours.weekday_text.map((e) => e.split(/\:\s+/))
            .map((e) => ({'days': e[0].substr(0, 3), 'hours': e[1]}));

  for (let i = 1; i < daysHours.length; i++) {
    if (daysHours[i - 1].hours === daysHours[i].hours) {
      if (daysHours[i - 1].days.indexOf('-') !== -1) {
        daysHours[i - 1].days =
            daysHours[i - 1].days.replace(/\w+$/, daysHours[i].days);
      } else {
        daysHours[i - 1].days += ' - ' + daysHours[i].days;
      }
      daysHours.splice(i--, 1);
    }
  }
  return daysHours;
}

/** Number of POIs to show on widget load. */
const ND_NUM_PLACES_INITIAL = 5;

/** Number of additional POIs to show when 'Show More' button is clicked. */
const ND_NUM_PLACES_SHOW_MORE = 5;

/** Maximum number of place photos to show on the details panel. */
const ND_NUM_PLACE_PHOTOS_MAX = 6;

/** Minimum zoom level at which the default map POI pins will be shown. */
const ND_DEFAULT_POI_MIN_ZOOM = 18;

/** Mapping of Place Types to Material Icons used to render custom map markers. */
const ND_MARKER_ICONS_BY_TYPE = {
  // Full list of icons can be found at https://fonts.google.com/icons
  '_default': 'circle',
  'hospital': 'local_hospital',
  'pharmacy': 'local_pharmacy',
};

/**
 * Defines an instance of the Neighborhood Discovery widget, to be
 * instantiated when the Maps library is loaded.
 */
function NeighborhoodDiscovery(configuration) {
  const widget = this;
  const widgetEl = document.querySelector('.neighborhood-discovery');

  widget.center = configuration.mapOptions.center;
  widget.places = configuration.pois || [];

  // Initialize core functionalities -------------------------------------

  initializeMap();
  initializePlaceDetails();
  initializeSidePanel();

  // Initialize additional capabilities ----------------------------------

  initializeSearchInput();

  // Initializer function definitions ------------------------------------

  /** Initializes the interactive map and adds place markers. */
  function initializeMap() {
    const mapOptions = configuration.mapOptions;
    widget.mapBounds = new google.maps.Circle(
      {center: widget.center, radius: configuration.mapRadius}).getBounds();
    mapOptions.restriction = {latLngBounds: widget.mapBounds};
    mapOptions.mapTypeControlOptions = {position: google.maps.ControlPosition.TOP_RIGHT};
    widget.map = new google.maps.Map(widgetEl.querySelector('.map'), mapOptions);
    widget.map.fitBounds(widget.mapBounds, /* padding= */ 0);
    widget.map.addListener('click', (e) => {
      // Check if user clicks on a POI pin from the base map.
      if (e.placeId) {
        e.stop();
        widget.selectPlaceById(e.placeId);
      }
    });
    widget.map.addListener('zoom_changed', () => {
      // Customize map styling to show/hide default POI pins or text based on zoom level.
      const hideDefaultPoiPins = widget.map.getZoom() < ND_DEFAULT_POI_MIN_ZOOM;
      widget.map.setOptions({
        styles: [{
          featureType: 'poi',
          elementType: hideDefaultPoiPins ? 'labels' : 'labels.text',
          stylers: [{visibility: 'off'}],
        }],
      });
    });

    const markerPath = widgetEl.querySelector('.marker-pin path').getAttribute('d');
    const drawMarker = function(title, position, fillColor, strokeColor, labelText) {
      return new google.maps.Marker({
        title: title,
        position: position,
        map: widget.map,
        icon: {
          path: markerPath,
          fillColor: fillColor,
          fillOpacity: 1,
          strokeColor: strokeColor,
          anchor: new google.maps.Point(13, 35),
          labelOrigin: new google.maps.Point(13, 13),
        },
        label: {
          text: labelText,
          color: 'white',
          fontSize: '16px',
          fontFamily: 'Material Icons',
        },
      });
    };

    // Add marker for the specified Place object.
    widget.addPlaceMarker = function(place) {
      place.marker = drawMarker(place.name, place.coords, '#EA4335', '#C5221F', place.icon);
      place.marker.addListener('click', () => void widget.selectPlaceById(place.placeId));
    };

    // Fit map to bounds that contain all markers of the specified Place objects.
    widget.updateBounds = function(places) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(widget.center);
      for (let place of places) {
        bounds.extend(place.marker.getPosition());
      }
      widget.map.fitBounds(bounds, /* padding= */ 100);
    };

    // Marker used to highlight a place from Autocomplete search.
    widget.selectedPlaceMarker = new google.maps.Marker({title: 'Point of Interest'});
  }

  /** Initializes Place Details service for the widget. */
  function initializePlaceDetails() {
    const detailsService = new google.maps.places.PlacesService(widget.map);
    const placeIdsToDetails = new Map();  // Create object to hold Place results.

    for (let place of widget.places) {
      placeIdsToDetails.set(place.placeId, place);
      place.fetchedFields = new Set(['place_id']);
    }

    widget.fetchPlaceDetails = function(placeId, fields, callback) {
      if (!placeId || !fields) return;

      // Check for field existence in Place object.
      let place = placeIdsToDetails.get(placeId);
      if (!place) {
        place = {placeId: placeId, fetchedFields: new Set(['place_id'])};
        placeIdsToDetails.set(placeId, place);
      }
      const missingFields = fields.filter((field) => !place.fetchedFields.has(field));
      if (missingFields.length === 0) {
        callback(place);
        return;
      }

      const request = {placeId: placeId, fields: missingFields};
      let retryCount = 0;
      const processResult = function(result, status) {
        if (status !== google.maps.places.PlacesServiceStatus.OK) {
          // If query limit has been reached, wait before making another call;
          // Increase wait time of each successive retry with exponential backoff
          // and terminate after five failed attempts.
          if (status === google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT &&
              retryCount < 5) {
            const delay = (Math.pow(2, retryCount) + Math.random()) * 500;
            setTimeout(() => void detailsService.getDetails(request, processResult), delay);
            retryCount++;
          }
          return;
        }

        // Basic details.
        if (result.name) place.name = result.name;
        if (result.geometry) place.coords = result.geometry.location;
        if (result.formatted_address) place.address = result.formatted_address;
        if (result.photos) {
          place.photos = result.photos.map((photo) => ({
            urlSmall: photo.getUrl({maxWidth: 200, maxHeight: 200}),
            urlLarge: photo.getUrl({maxWidth: 1200, maxHeight: 1200}),
            attrs: photo.html_attributions,
          })).slice(0, ND_NUM_PLACE_PHOTOS_MAX);
        }
        if (result.types) {
          place.type = formatPlaceType(result.types[0]);
          place.icon = ND_MARKER_ICONS_BY_TYPE['_default'];
          for (let type of result.types) {
            if (type in ND_MARKER_ICONS_BY_TYPE) {
              place.type = formatPlaceType(type);
              place.icon = ND_MARKER_ICONS_BY_TYPE[type];
              break;
            }
          }
        }
        if (result.url) place.url = result.url;

        // Contact details.
        if (result.website) {
          place.website = result.website;
          const url = new URL(place.website);
          place.websiteDomain = url.hostname;
        }
        if (result.formatted_phone_number) place.phoneNumber = result.formatted_phone_number;
        if (result.opening_hours) place.openingHours = parseDaysHours(result.opening_hours);

        // Review details.
        if (result.rating) {
          place.rating = result.rating;
          addStarIcons(place);
        }
        if (result.user_ratings_total) place.numReviews = result.user_ratings_total;
        if (result.price_level) {
          place.priceLevel = result.price_level;
          place.dollarSigns = initArray(result.price_level);
        }
        if (result.reviews) {
          place.reviews = result.reviews;
          for (let review of place.reviews) {
            addStarIcons(review);
          }
        }

        for (let field of missingFields) {
          place.fetchedFields.add(field);
        }
        callback(place);
      };

      // Use result from Place Autocomplete if available.
      if (widget.placeIdsToAutocompleteResults) {
        const autoCompleteResult = widget.placeIdsToAutocompleteResults.get(placeId);
        if (autoCompleteResult) {
          processResult(autoCompleteResult, google.maps.places.PlacesServiceStatus.OK);
          return;
        }
      }
      detailsService.getDetails(request, processResult);
    };
  }

  /** Initializes the side panel that holds curated POI results. */
  function initializeSidePanel() {
    const placesPanelEl = widgetEl.querySelector('.places-panel');
    const detailsPanelEl = widgetEl.querySelector('.details-panel');
    const placeResultsEl = widgetEl.querySelector('.place-results-list');
    const showMoreButtonEl = widgetEl.querySelector('.show-more-button');
    const photoModalEl = widgetEl.querySelector('.photo-modal');
    const detailsTemplate = Handlebars.compile(
        document.getElementById('nd-place-details-tmpl').innerHTML);
    const resultsTemplate = Handlebars.compile(
        document.getElementById('nd-place-results-tmpl').innerHTML);

    // Show specified POI photo in a modal.
    const showPhotoModal = function(photo, placeName) {
      const prevFocusEl = document.activeElement;
      const imgEl = photoModalEl.querySelector('img');
      imgEl.src = photo.urlLarge;
      const backButtonEl = photoModalEl.querySelector('.back-button');
      backButtonEl.addEventListener('click', () => {
        hideElement(photoModalEl, prevFocusEl);
        imgEl.src = '';
      });
      photoModalEl.querySelector('.photo-place').innerHTML = placeName;
      photoModalEl.querySelector('.photo-attrs span').innerHTML = photo.attrs;
      const attributionEl = photoModalEl.querySelector('.photo-attrs a');
      if (attributionEl) attributionEl.setAttribute('target', '_blank');
      photoModalEl.addEventListener('click', (e) => {
        if (e.target === photoModalEl) {
          hideElement(photoModalEl, prevFocusEl);
          imgEl.src = '';
        }
      });
      showElement(photoModalEl, backButtonEl);
    };

    // Select a place by id and show details.
    let selectedPlaceId;
    widget.selectPlaceById = function(placeId, panToMarker) {
      if (selectedPlaceId === placeId) return;
      selectedPlaceId = placeId;
      const prevFocusEl = document.activeElement;

      const showDetailsPanel = function(place) {
        detailsPanelEl.innerHTML = detailsTemplate(place);
        const backButtonEl = detailsPanelEl.querySelector('.back-button');
        backButtonEl.addEventListener('click', () => {
          hideElement(detailsPanelEl, prevFocusEl);
          selectedPlaceId = undefined;
          widget.selectedPlaceMarker.setMap(null);
        });
        detailsPanelEl.querySelectorAll('.photo').forEach((photoEl, i) => {
          photoEl.addEventListener('click', () => {
            showPhotoModal(place.photos[i], place.name);
          });
        });
        showElement(detailsPanelEl, backButtonEl);
        detailsPanelEl.scrollTop = 0;
      };

      const processResult = function(place) {
        if (place.marker) {
          widget.selectedPlaceMarker.setMap(null);
        } else {
          widget.selectedPlaceMarker.setPosition(place.coords);
          widget.selectedPlaceMarker.setMap(widget.map);
        }
        if (panToMarker) {
          widget.map.panTo(place.coords);
        }
        showDetailsPanel(place);
      };

      widget.fetchPlaceDetails(placeId, [
        'name', 'types', 'geometry.location', 'formatted_address', 'photo', 'url',
        'website', 'formatted_phone_number', 'opening_hours',
        'rating', 'user_ratings_total', 'price_level', 'review',
      ], processResult);
    };

    // Render the specified place objects and append them to the POI list.
    const renderPlaceResults = function(places, startIndex) {
      placeResultsEl.insertAdjacentHTML('beforeend', resultsTemplate({places: places}));
      placeResultsEl.querySelectorAll('.place-result').forEach((resultEl, i) => {
        const place = places[i - startIndex];
        if (!place) return;
        // Clicking anywhere on the item selects the place.
        // Additionally, create a button element to make this behavior
        // accessible under tab navigation.
        resultEl.addEventListener('click', () => {
          widget.selectPlaceById(place.placeId, /* panToMarker= */ true);
        });
        resultEl.querySelector('.name').addEventListener('click', (e) => {
          widget.selectPlaceById(place.placeId, /* panToMarker= */ true);
          e.stopPropagation();
        });
        resultEl.querySelector('.photo').addEventListener('click', (e) => {
          showPhotoModal(place.photos[0], place.name);
          e.stopPropagation();
        });
        widget.addPlaceMarker(place);
      });
    };

    // Index of next Place object to show in the POI list.
    let nextPlaceIndex = 0;

    // Fetch and show basic info for the next N places.
    const showNextPlaces = function(n) {
      const nextPlaces = widget.places.slice(nextPlaceIndex, nextPlaceIndex + n);
      if (nextPlaces.length < 1) {
        hideElement(showMoreButtonEl);
        return;
      }
      showMoreButtonEl.disabled = true;
      // Keep track of the number of Places calls that have not finished.
      let count = nextPlaces.length;
      for (let place of nextPlaces) {
        const processResult = function(place) {
          count--;
          if (count > 0) return;
          renderPlaceResults(nextPlaces, nextPlaceIndex);
          nextPlaceIndex += n;
          widget.updateBounds(widget.places.slice(0, nextPlaceIndex));
          const hasMorePlacesToShow = nextPlaceIndex < widget.places.length;
          if (hasMorePlacesToShow || hasHiddenContent(placesPanelEl)) {
            showElement(showMoreButtonEl);
            showMoreButtonEl.disabled = false;
          } else {
            hideElement(showMoreButtonEl);
          }
        };
        widget.fetchPlaceDetails(place.placeId, [
          'name', 'types', 'geometry.location',
          'photo',
          'rating', 'user_ratings_total', 'price_level',
        ], processResult);
      }
    };
    showNextPlaces(ND_NUM_PLACES_INITIAL);

    showMoreButtonEl.addEventListener('click', () => {
      placesPanelEl.classList.remove('no-scroll');
      showMoreButtonEl.classList.remove('sticky');
      showNextPlaces(ND_NUM_PLACES_SHOW_MORE);
    });
  }

  /** Initializes Search Input for the widget. */
  function initializeSearchInput() {
    const searchInputEl = widgetEl.querySelector('.place-search-input');
    widget.placeIdsToAutocompleteResults = new Map();

    // Set up Autocomplete on the search input.
    const autocomplete = new google.maps.places.Autocomplete(searchInputEl, {
      types: ['establishment'],
      fields: [
        'place_id', 'name', 'types', 'geometry.location', 'formatted_address', 'photo', 'url',
        'website', 'formatted_phone_number', 'opening_hours',
        'rating', 'user_ratings_total', 'price_level', 'review',
      ],
      bounds: widget.mapBounds,
      strictBounds: true,
    });
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      widget.placeIdsToAutocompleteResults.set(place.place_id, place);
      widget.selectPlaceById(place.place_id, /* panToMarker= */ true);
      searchInputEl.value = '';
    });
  }
}