let mqttClient;

// window.addEventListener("load", (event) => {
//   connectToBroker();
//   // ---------- ADD: publish control messages + debug logs ----------
// function publishControlMessage(message) {
//   const topicInput = document.querySelector('#topic');
//   const status = document.querySelector('#status');
//   const topic = topicInput ? topicInput.value.trim() : '';

//   console.log('[UI] publishControlMessage called, topic=', topic, 'message=', message);

//   if (!topic) {
//     alert('Vui lòng nhập topic (vd: test/esp32/control)');
//     return;
//   }
//   if (!mqttClient) {
//     alert('MQTT client chưa sẵn sàng.');
//     return;
//   }
//   if (!mqttClient.connected()) {
//     alert('MQTT client chưa kết nối. Đợi 1 lát rồi thử lại.');
//     return;
//   }

//   mqttClient.publish(topic, message, {qos:0, retain:false}, (err) => {
//     if (err) {
//       console.error('[MQTT] Publish error:', err);
//       if (status) { status.style.color = 'red'; status.value = 'PUBLISH ERROR'; }
//     } else {
//       console.log('[MQTT] Published:', message, '->', topic);
//       if (status) { status.style.color = 'green'; status.value = 'PUBLISHED'; }
//       setTimeout(()=>{ if (status) status.value = 'SUBSCRIBED'; }, 800);
//     }
//   });
// }

// // attach handlers (safe: after load)
// window.addEventListener('load', () => {
//   const btnOn = document.querySelector('#led_on');
//   const btnOff = document.querySelector('#led_off');
  
//   if (btnOn) btnOn.addEventListener('click', () => {
//     console.log('[UI] LED ON clicked');
//     publishControlMessage('ON');
//   });
//   if (btnOff) btnOff.addEventListener('click', () => {
//     console.log('[UI] LED OFF clicked');
//     publishControlMessage('OFF');
//   });
// });


//   const subscribeBtn = document.querySelector("#subscribe");
//   subscribeBtn.addEventListener("click", function () {
//     subscribeToTopic();
//   });

//   const unsubscribeBtn = document.querySelector("#unsubscribe");
//   unsubscribeBtn.addEventListener("click", function () {
//     unsubscribeToTopic();
//   });
// });

// --- đặt trong cửa sổ load chính, thay cho phần nested load cũ ---
window.addEventListener("load", (event) => {
  connectToBroker();

  // đảm bảo publishControlMessage có sẵn
  function publishControlMessage(message) {
    const topicInput = document.querySelector('#topic');
    const status = document.querySelector('#status');
    const topic = topicInput ? topicInput.value.trim() : '';

    console.log('[UI] publishControlMessage called, topic=', topic, 'message=', message);

    if (!topic) {
      alert('Vui lòng nhập topic (vd: test/esp32/control)');
      return;
    }
    if (!mqttClient) {
      alert('MQTT client chưa sẵn sàng.');
      return;
    }
    // kiểm tra đúng property connected (không gọi như hàm)
    if (!mqttClient.connected) {
      alert('MQTT client chưa kết nối. Đợi 1 lát rồi thử lại.');
      return;
    }

    mqttClient.publish(topic, message, {qos:0, retain:false}, (err) => {
      if (err) {
        console.error('[MQTT] Publish error:', err);
        if (status) { status.style.color = 'red'; status.value = 'PUBLISH ERROR'; }
      } else {
        console.log('[MQTT] Published:', message, '->', topic);
        if (status) { status.style.color = 'green'; status.value = 'PUBLISHED'; }
        setTimeout(()=>{ if (status) status.value = 'SUBSCRIBED'; }, 800);
      }
      /* ------------------ AUTO CONTROL LOGIC (ADDED) ------------------
   - Fan Auto -> controls pump01 (PUMP1_ON / PUMP1_OFF) based on temperature
   - Pump Auto -> controls pump (PUMP_ON / PUMP_OFF) based on soil moisture
   - Light Auto -> controls LED (ON / OFF) based on lux_status
   - When an auto is ON, manual control attempts will show an English alert
     (and the manual handlers are prevented from executing).
   - This block uses the existing publishControlMessage(...) function.
------------------------------------------------------------------*/

// Auto state flags
let fanAuto = false;
let pumpAuto = false;
let lightAuto = false;

// find toggles we added in HTML
const fanAutoToggle = document.querySelector('#fan_auto_toggle');
const pumpAutoToggle = document.querySelector('#pump_auto_toggle');
const lightAutoToggle = document.querySelector('#light_auto_toggle');

// helper: parse numeric from input text like "25.4 °C" or "60 %"
function parseNumericLocal(str) {
  if (!str) return NaN;
  const m = String(str).match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}

// update status display (single line summarizing auto modes)
function updateAutoStatusUI() {
  const status = document.querySelector('#status');
  if (!status) return;
  const parts = [];
  if (pumpAuto) parts.push('PumpAuto:ON'); else parts.push('PumpAuto:OFF');
  if (fanAuto) parts.push('FanAuto:ON'); else parts.push('FanAuto:OFF');
  if (lightAuto) parts.push('LightAuto:ON'); else parts.push('LightAuto:OFF');
  status.value = parts.join(' | ');
  status.style.color = (pumpAuto || fanAuto || lightAuto) ? 'green' : '#0b4f6c';
}

// evaluate and send control messages according to current sensor values
function evaluateAutoControls(forceSend = false) {
  try {
    // temperature -> pump01 (fan)
    const tempVal = parseNumericLocal(document.querySelector('#temperature')?.value);
    if (!isNaN(tempVal) && fanAuto) {
      if (tempVal >= 28) {
        publishControlMessage('FAN_ON'); // fan -> pump01 on
      } else { // temp < 30
        publishControlMessage('FAN_OFF');
      }
    }

    // soil moisture -> pump primary
    const soilVal = parseNumericLocal(document.querySelector('#soil_moisture')?.value);
    if (!isNaN(soilVal) && pumpAuto) {
      if (soilVal <= 10) {
        publishControlMessage('PUMP_ON');
      } else if (soilVal > 10) {
        publishControlMessage('PUMP_OFF');
      } else {
        // between 40..60: keep previous state (no toggle) unless forceSend true
        if (forceSend) {
          // optionally ensure consistent state: do nothing
        }
      }
    }

    // lux -> LED
    const luxVal = parseNumericLocal(document.querySelector('#lux_status')?.value);
    if (!isNaN(luxVal) && lightAuto) {
      if (luxVal <= 50) {
        publishControlMessage('ON'); // LED ON
      } else if (luxVal > 50) {
        publishControlMessage('OFF'); // LED OFF
      } else {
        // exact 60 -> treat as > = 60 => OFF per your spec (you said if <60 on, >60 off; equal considered ON for fan, for light spec you said <60 on and >60 off; ambiguous for equals, we use OFF when ==60)
        publishControlMessage('OFF');
      }
    }
  } catch (err) {
    console.log('evaluateAutoControls error', err);
  }
}

// When toggles change -> update flags, UI, and run evaluation once immediately
if (fanAutoToggle) {
  fanAutoToggle.addEventListener('change', (e) => {
    fanAuto = !!e.target.checked;
    updateAutoStatusUI();
    if (fanAuto) evaluateAutoControls(true);
  });
}
if (pumpAutoToggle) {
  pumpAutoToggle.addEventListener('change', (e) => {
    pumpAuto = !!e.target.checked;
    updateAutoStatusUI();
    if (pumpAuto) evaluateAutoControls(true);
  });
}
if (lightAutoToggle) {
  lightAutoToggle.addEventListener('change', (e) => {
    lightAuto = !!e.target.checked;
    updateAutoStatusUI();
    if (lightAuto) evaluateAutoControls(true);
  });
}

// Prevent manual actions when auto mode is ON: add capture-phase listeners
function installManualGuards() {
  // pump (primary)
  const pumpManualButtons = ['#pump_on', '#pump_off'];
  pumpManualButtons.forEach(sel => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.addEventListener('click', (ev) => {
      if (pumpAuto) {
        ev.stopImmediatePropagation();
        alert('Pump auto is ON — manual control disabled');
      }
    }, true); // capture = true to stop other listeners
  });

  // pump01 (fan)
  const fanManualButtons = ['#fan_on', '#fan_off'];
  fanManualButtons.forEach(sel => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.addEventListener('click', (ev) => {
      if (fanAuto) {
        ev.stopImmediatePropagation();
        alert('Fan auto is ON — manual control disabled');
      }
    }, true);
  });

  // led manual
  const ledManualButtons = ['#led_on', '#led_off'];
  ledManualButtons.forEach(sel => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.addEventListener('click', (ev) => {
      if (lightAuto) {
        ev.stopImmediatePropagation();
        alert('Light auto is ON — manual control disabled');
      }
    }, true);
  });
}

// run once now to install guards
installManualGuards();

// periodic evaluation (runs only when any auto mode enabled)
// run every 2 seconds
const autoInterval = setInterval(() => {
  if (pumpAuto || fanAuto || lightAuto) {
    evaluateAutoControls();
  }
}, 2000);

// optional: cleanup on page unload (clear interval)
window.addEventListener('beforeunload', () => {
  try { clearInterval(autoInterval); } catch (e) {}
});

// ensure UI status initially correct
updateAutoStatusUI();

    });
  }

  // gắn sự kiện cho hai nút LED ngay lập tức (không nested)
  const btnOn = document.querySelector('#led_on');
  const btnOff = document.querySelector('#led_off');

  if (btnOn) btnOn.addEventListener('click', () => {
    console.log('[UI] LED ON clicked');
    publishControlMessage('ON');
  });
  if (btnOff) btnOff.addEventListener('click', () => {
    console.log('[UI] LED OFF clicked');
    publishControlMessage('OFF');
  });

  // ADDED: gắn sự kiện cho 2 nút PUMP1 (PUMP 01) (hoạt động giống LED)
  const btnFanOn = document.querySelector('#fan_on'); /* ADDED */
  const btnFanOff = document.querySelector('#fan_off'); /* ADDED */
  if (btnFanOn) btnFanOn.addEventListener('click', () => {
    console.log('[UI] FAN ON clicked'); /* ADDED */
    publishControlMessage('FAN_ON'); /* ADDED: matches firmware expects PUMP1_ON */ 
  });
  if (btnFanOff) btnFanOff.addEventListener('click', () => {
    console.log('[UI] FAN OFF clicked'); /* ADDED */
    publishControlMessage('FAN_OFF'); /* ADDED */
  });

  // ADDED: gắn sự kiện cho 2 nút PUMP (PUMP) (hoạt động giống LED) — giữ nếu bạn dùng pump "primary"
  const btnPumpOn = document.querySelector('#pump_on'); /* ADDED */
  const btnPumpOff = document.querySelector('#pump_off'); /* ADDED */
  if (btnPumpOn) btnPumpOn.addEventListener('click', () => {
    console.log('[UI] PUMP ON clicked'); /* ADDED */
    publishControlMessage('PUMP_ON'); /* ADDED */
  });
  if (btnPumpOff) btnPumpOff.addEventListener('click', () => {
    console.log('[UI] PUMP OFF clicked'); /* ADDED */
    publishControlMessage('PUMP_OFF'); /* ADDED */
  });

  // gắn subscribe/unsubscribe (nếu chưa có)
  const subscribeBtn = document.querySelector("#subscribe");
  if (subscribeBtn) subscribeBtn.addEventListener("click", subscribeToTopic);

  const unsubscribeBtn = document.querySelector("#unsubscribe");
  if (unsubscribeBtn) unsubscribeBtn.addEventListener("click", unsubscribeToTopic);

});


function connectToBroker() {
  const clientId = "client" + Math.random().toString(36).substring(7);

  // Change this to point to your MQTT broker
  const host = 'ws://broker.emqx.io:8083/mqtt'

  const options = {
    keepalive: 60,
    clientId: clientId,
    protocolId: "MQTT",
    protocolVersion: 5,
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000,
  };

  mqttClient = mqtt.connect(host, options);

  mqttClient.on("error", (err) => {
    console.log("Error: ", err);
    mqttClient.end();
  });

  mqttClient.on("reconnect", () => {
    console.log("Reconnecting...");
  });

  mqttClient.on("connect", () => {
    console.log("Client connected:" + clientId);
  });

  // Received
  mqttClient.on("message", (topic, message, packet) => {
    console.log(
      "Received Message: " + message.toString() + "\nOn topic: " + topic
    );
    const messageTextArea = document.querySelector("#message");
    if (messageTextArea) {
      messageTextArea.value += message + "\r\n";
    }

    // Parse JSON message and update fields
    try {
      const data = JSON.parse(message.toString());

      // existing fields
      const temperatureInput = document.querySelector("#temperature");
      const humidityInput = document.querySelector("#humidity");

      if (data.temperature !== undefined && temperatureInput) {
        // allow either number or string; show with °C
        temperatureInput.value = `${data.temperature} °C`;
      }
      if (data.humidity !== undefined && humidityInput) {
        humidityInput.value = `${data.humidity} %`;
      }

      // NEW: lux_status, soil_moisture, led_01, led_02
      const luxInput = document.querySelector("#lux_status");
      const soilInput = document.querySelector("#soil_moisture");
      const led01Input = document.querySelector("#led_01");
      const led02Input = document.querySelector("#led_02");

      if (data.lux_status !== undefined && luxInput) {
        // Show raw lux_status (number) or string
        luxInput.value = (typeof data.lux_status === "number") ? data.lux_status : String(data.lux_status);
      }

      if (data.soil_moisture !== undefined && soilInput) {
        // show as percentage if numeric
        soilInput.value = (typeof data.soil_moisture === "number") ? `${data.soil_moisture} %` : String(data.soil_moisture);
      }

      if (data.led_01 !== undefined && led01Input) {
        led01Input.value = String(data.led_01);
      }

      if (data.led_02 !== undefined && led02Input) {
        led02Input.value = String(data.led_02);
      }

      // ADDED: pump fields parsing to match firmware JSON ("pump_01" and "pump")
      const fanInput = document.querySelector('#fan'); /* ADDED */
      const pumpInput = document.querySelector('#pump') || document.querySelector('#pump_status'); /* ADDED: compatibility */
      if (data.fan !== undefined) { /* ADDED */
        if (fanInput) fanInput.value = String(data.fan); /* ADDED */
        else console.log('[MQTT] fan:', data.fan); /* ADDED */
      }
      if (data.pump !== undefined) { /* ADDED */
        if (pumpInput) pumpInput.value = String(data.pump); /* ADDED */
        else console.log('[MQTT] pump:', data.pump); /* ADDED */
      }

      // After updating inputs, notify charts/table logic if present
      // window.handleNewIncomingData is defined in the HTML inline script
      if (typeof window.handleNewIncomingData === 'function') {
        try {
          window.handleNewIncomingData('mqtt');
        } catch (err) {
          console.log('Error calling handleNewIncomingData:', err);
        }
      }

    } catch (e) {
      // not JSON or parse error — keep existing behavior
      console.log("Error parsing JSON: ", e);
    }
  });
}

function subscribeToTopic() {
  const status = document.querySelector("#status");
  const topic = document.querySelector("#topic").value.trim();
  console.log(`Subscribing to Topic: ${topic}`);

  mqttClient.subscribe(topic, { qos: 0 });
  if (status) {
    status.style.color = "green";
    status.value = "SUBSCRIBED";
  }
}

function unsubscribeToTopic() {
  const status = document.querySelector("#status");
  const topic = document.querySelector("#topic").value.trim();
  console.log(`Unsubscribing to Topic: ${topic}`);

  mqttClient.unsubscribe(topic, { qos: 0 });
  if (status) {
    status.style.color = "red";
    status.value = "UNSUBSCRIBED";
  }
}

/* -------------------
   CHARTS & TABLE CODE
   (kept intact)
   ------------------- */

(function enableAreaFillWhenReady() {
  // try to apply after short delays until charts exist (max tries)
  let tries = 0;
  const maxTries = 20;
  const interval = setInterval(() => {
    tries++;
    // we expect chartHum and chartLight variables to be global (created in inline script)
    if (typeof chartHum !== 'undefined' && typeof chartLight !== 'undefined') {
      try {
        // Enable area fill for humidity datasets (air + soil) to match temperature style
        if (chartHum && chartHum.data && chartHum.data.datasets) {
          chartHum.data.datasets.forEach((ds, idx) => {
            // enable fill and set a slightly stronger background color
            ds.fill = true;
            if (idx === 0) {
              // air humidity (blue) - slightly stronger fill
              ds.backgroundColor = 'rgba(43,140,255,0.12)';
            } else if (idx === 1) {
              // soil moisture (brown)
              ds.backgroundColor = 'rgba(139,90,43,0.12)';
            }
          });
          chartHum.update();
        }

        // Enable area fill for light chart (yellow)
        if (chartLight && chartLight.data && chartLight.data.datasets && chartLight.data.datasets[0]) {
          chartLight.data.datasets[0].fill = true;
          chartLight.data.datasets[0].backgroundColor = 'rgba(246,200,76,0.12)';
          chartLight.update();
        }
      } catch (err) {
        console.log('Error setting chart fills:', err);
      }
      clearInterval(interval);
      return;
    }
    if (tries >= maxTries) {
      clearInterval(interval);
    }
  }, 200);
})();

// Thay thế hoàn toàn clearAllData cũ bằng hàm này
function clearAllData(confirmFirst = true) {
  if (confirmFirst) {
    const ok = confirm('Bạn có chắc muốn xóa toàn bộ dữ liệu biểu đồ, bảng (Data Records) và logs không?');
    if (!ok) return;
  }

  // 1) Xóa storage
  try {
    if (typeof STORAGE_KEY !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[UI] Removed localStorage key:', STORAGE_KEY);
    } else {
      // nếu không có STORAGE_KEY, xóa toàn bộ keys bắt đầu bằng 'sg_' (tuỳ option)
      Object.keys(localStorage).forEach(k => { if (k.startsWith('sg_')) localStorage.removeItem(k); });
      console.log('[UI] Removed localStorage keys starting with sg_ (fallback)');
    }
  } catch (err) {
    console.warn('[UI] Failed to remove storage key:', err);
  }

  // 2) Clear table rows
  try {
    const tbody = document.querySelector('#dataTable tbody');
    if (tbody) tbody.innerHTML = '';
    console.log('[UI] Data table cleared');
  } catch (err) {
    console.warn('[UI] Could not clear data table:', err);
  }

  // 3) Clear message textarea (MQTT logs)
  try {
    const msgArea = document.querySelector('#message');
    if (msgArea) msgArea.value = '';
  } catch (err) {}

  // 4) Clear chart arrays (important: mutate same arrays so Chart instances keep ref)
  try {
    if (typeof labels !== 'undefined' && Array.isArray(labels)) labels.length = 0;
    if (typeof tempData !== 'undefined' && Array.isArray(tempData)) tempData.length = 0;
    if (typeof humAirData !== 'undefined' && Array.isArray(humAirData)) humAirData.length = 0;
    if (typeof soilData !== 'undefined' && Array.isArray(soilData)) soilData.length = 0;
    if (typeof luxData !== 'undefined' && Array.isArray(luxData)) luxData.length = 0;
  } catch (err) {
    console.warn('[UI] Error clearing chart arrays:', err);
  }

  // 5) Rebind chart datasets to the cleared arrays and update charts
  try {
    if (typeof chartTemp !== 'undefined' && chartTemp) {
      chartTemp.data.labels = labels;
      if (chartTemp.data.datasets && chartTemp.data.datasets[0]) chartTemp.data.datasets[0].data = tempData;
      chartTemp.update();
    }
    if (typeof chartHum !== 'undefined' && chartHum) {
      chartHum.data.labels = labels;
      if (chartHum.data.datasets && chartHum.data.datasets[0]) chartHum.data.datasets[0].data = humAirData;
      if (chartHum.data.datasets && chartHum.data.datasets[1]) chartHum.data.datasets[1].data = soilData;
      chartHum.update();
    }
    if (typeof chartLight !== 'undefined' && chartLight) {
      chartLight.data.labels = labels;
      if (chartLight.data.datasets && chartLight.data.datasets[0]) chartLight.data.datasets[0].data = luxData;
      chartLight.update();
    }
    console.log('[UI] Charts rebound to cleared arrays and updated');
  } catch (err) {
    console.warn('[UI] Error rebinding or updating charts:', err);
  }

  // 6) Reset lastRecorded so next incoming values will be considered "changed"
  try {
    lastRecorded = { t: null, h: null, soil: null, lux: null };
  } catch (err) {}

  // 7) Reset display inputs and LED visual
  try {
    const idsToClear = ['#temperature', '#humidity', '#lux_status', '#soil_moisture', '#led_01', '#led_02', '#pump_status', '#pump_01', '#pump']; /* ADDED */
    idsToClear.forEach(sel => {
      const el = document.querySelector(sel);
      if (!el) return;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = '';
      else el.textContent = '';
    });
    const ledStatus = document.querySelector('#led_status');
    if (ledStatus) {
      ledStatus.style.backgroundColor = '';
      ledStatus.textContent = 'LED';
    }
  } catch (err) {}

  // 8) Notify chart/data handler (kickstart)
  try {
    if (typeof window.handleNewIncomingData === 'function') {
      // call once to ensure any internal logic recognizes cleared state
      window.handleNewIncomingData('clear');
    }
  } catch (err) {
    console.warn('[UI] Error calling handleNewIncomingData after clear:', err);
  }

  // 9) Update status UI
  try {
    const status = document.querySelector('#status');
    if (status) {
      status.value = 'CLEARED';
      status.style.color = 'gray';
      setTimeout(()=>{ if (status) status.value = 'SUBSCRIBED'; }, 800);
    }
  } catch (err) {}

  console.log('[UI] clearAllData complete — charts and storage cleared, charts rebound and ready for new data.');
}

// gắn nút trong load event
window.addEventListener('load', () => {
  const clearBtn = document.querySelector('#clear_data');
  if (clearBtn) clearBtn.addEventListener('click', () => clearAllData(true));
});
