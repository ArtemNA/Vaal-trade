using System;
using System.Runtime.InteropServices;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Interop;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using System.Threading;
using System.Diagnostics;
using System.Windows.Input;
using System.Windows.Controls;
using System.Security.Policy;
using System.Net.Http.Headers;

namespace PoeOverlayApp
{
    public partial class MainWindow : Window
    {
        // Для глобального прослуховування клавіш
        [DllImport("user32.dll")]
        private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

        [DllImport("user32.dll")]
        private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

        private const int HOTKEY_ID = 9000; // Ідентифікатор гарячої клавіші
        private const uint MOD_CONTROL = 0x0002;
        private const uint VK_Q = 0x51;

        private readonly HttpClient _httpClient = new HttpClient();
        public MainWindow()
        {
            InitializeComponent();
            SetFullScreen();
            Loaded += MainWindow_Loaded;
        }

        private void SetFullScreen()
        {
            // Встановлюємо вікно на весь екран
            this.Left = 0;
            this.Top = 0;
            this.Width = SystemParameters.PrimaryScreenWidth;
            this.Height = SystemParameters.PrimaryScreenHeight;

            // Знімаємо фокус із панелі завдань
            var hwnd = new WindowInteropHelper(this).Handle;
            SetWindowLong(hwnd, GWL_EXSTYLE, GetWindowLong(hwnd, GWL_EXSTYLE) | WS_EX_TOOLWINDOW);
        }

        private const int GWL_EXSTYLE = -20;
        private const int WS_EX_TOOLWINDOW = 0x00000080;

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

        // Сховати вікно при натисканні Esc
        private void Window_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Escape)
            {
                HideWindowToTray();
            }
        }

        private void OnBackgroundClick(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            // Перевіряємо, чи користувач клікнув поза Angular-вікном
            if (e.OriginalSource is Grid)
            {
                HideWindowToTray();
            }
        }

        // Сховати вікно при втраті фокусу
        private void Window_Deactivated(object sender, EventArgs e)
        {
            HideWindowToTray();
        }

        public void HideWindowToTray()
        {
            this.Hide();
        }

        // Показати вікно як оверлей
        public void ShowOverlay()
        {
            this.Show();
            this.Activate();
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            try
            {
                await webView.EnsureCoreWebView2Async();

                var htmlPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/browser");
                var absolutePath = Path.GetFullPath(htmlPath);

                webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "app.local",
                    absolutePath,
                    CoreWebView2HostResourceAccessKind.Allow);

                webView.Source = new Uri("https://app.local/index.html");

                webView.CoreWebView2.WebMessageReceived += WebView2_WebMessageReceived;

                var windowHandle = new WindowInteropHelper(this).Handle;
                RegisterHotKey(windowHandle, HOTKEY_ID, MOD_CONTROL, VK_Q);

                ComponentDispatcher.ThreadPreprocessMessage += ThreadPreprocessMessage;
            }
            catch (Exception ex)
            {
                ShowDebugMessage($"WebView Initialization Error: {ex.Message}");
            }
        }

        private void MainWindow_Closed(object sender, EventArgs e)
        {
            var windowHandle = new WindowInteropHelper(this).Handle;
            UnregisterHotKey(windowHandle, HOTKEY_ID);
        }

        private void ThreadPreprocessMessage(ref MSG msg, ref bool handled)
        {
            const int WM_HOTKEY = 0x0312;

            if (msg.message == WM_HOTKEY && msg.wParam.ToInt32() == HOTKEY_ID)
            {
                handled = true;
                HandleCtrlQPressed();
            }
        }

        private void HandleCtrlQPressed()
        {
            if (!IsPathOfExileActive())
            {
                Console.WriteLine("Path of Exile is not the active window. Ignoring Ctrl+Q.");
                return;
            }
            try
            {
                // Очищаємо буфер обміну перед копіюванням
                Clipboard.Clear();
                Thread.Sleep(100); // Невелика затримка після очищення

                // Виконуємо Ctrl+C для копіювання тексту
                SimulateCopy();

                // Чекаємо на оновлення буфера
                string clipboardText = WaitForClipboardText(2000); // Збільшений таймаут до 2 секунд

                if (!string.IsNullOrEmpty(clipboardText) && clipboardText.StartsWith("Item Class:"))
                {
                    // Надсилаємо текст у Angular
                    webView.CoreWebView2.PostWebMessageAsJson(System.Text.Json.JsonSerializer.Serialize(new
                    {
                        action = "loadItemFromClipboard",
                        payload = clipboardText
                    }));

                    Application.Current.Dispatcher.Invoke(() =>
                    {
                        ShowOverlay();
                    });
                }
                else
                {
                    ShowDebugMessage("Clipboard did not contain valid item data after Ctrl+C.");
                }
            }
            catch (Exception ex)
            {
                ShowDebugMessage($"Error handling Ctrl+Q: {ex.Message}");
            }
        }

        private string WaitForClipboardText(int timeoutMs)
        {
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            string previousText = string.Empty;

            while (stopwatch.ElapsedMilliseconds < timeoutMs)
            {
                try
                {
                    if (Clipboard.ContainsText())
                    {
                        var currentText = Clipboard.GetText();
                        if (!string.IsNullOrEmpty(currentText) && currentText != previousText)
                        {
                            return currentText; // Новий текст отримано, повертаємо
                        }
                        previousText = currentText; // Оновлюємо попередній текст
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Clipboard access error: {ex.Message}");
                }

                Thread.Sleep(100); // Затримка перед повторною перевіркою
            }

            return null; // Якщо не вдалося отримати текст
        }


        private void SimulateCopy()
        {
            try
            {
                const byte VK_CONTROL = 0x11;
                const byte C_KEY = 0x43;

                keybd_event(VK_CONTROL, 0, 0, 0); // Натискаємо Ctrl
                keybd_event(C_KEY, 0, 0, 0);      // Натискаємо C
                Thread.Sleep(50);                // Невелика затримка для стабільності
                keybd_event(C_KEY, 0, 2, 0);      // Відпускаємо C
                keybd_event(VK_CONTROL, 0, 2, 0); // Відпускаємо Ctrl
            }
            catch (Exception ex)
            {
                ShowDebugMessage($"Failed to simulate Ctrl+C: {ex.Message}");
            }
        }


        [DllImport("user32.dll", SetLastError = true)]
        private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);

        private async void WebView2_WebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                var message = e.TryGetWebMessageAsString();
                if (!string.IsNullOrEmpty(message))
                {
                    //ShowDebugMessage($"Received message: {message}"); // Логування отриманого повідомлення

                    var data = JsonSerializer.Deserialize<JsonElement>(message);
                    var action = data.GetProperty("action").GetString();

                    switch (action)
                    {
                        case "getClipboardText":
                            var clipboardText = Clipboard.ContainsText()
                                ? Clipboard.GetText()
                                : "Clipboard is empty.";

                            var clipboardResponse = new
                            {
                                action = "getClipboardTextResponse",
                                payload = clipboardText
                            };
                            //ShowDebugMessage($"clipboardText: {clipboardText}");

                            ValidateAndSendMessage(clipboardResponse);
                            break;

                        case "sendPayload":
                            var payload = data.GetProperty("payload").ToString();
                            await HandleTradeSearch(payload);
                            break;

                        case "openInBrowser":
                            var url = data.GetProperty("payload").ToString();
                            OpenUrlInBrowser(url);
                            HideWindowToTray();
                            break;

                        default:
                            ShowDebugMessage($"Unknown action: {action}");
                            break;
                    }
                }
            }
            catch (JsonException jsonEx)
            {
                ShowDebugMessage($"JSON Error: {jsonEx.Message}");
            }
            catch (ArgumentException argEx)
            {
                ShowDebugMessage($"Argument Error: {argEx.Message}");
            }
            catch (Exception ex)
            {
                ShowDebugMessage($"Message Handling Error: {ex.Message}");
            }
        }


        private void ValidateAndSendMessage(object message)
        {
            try
            {
                var jsonString = JsonSerializer.Serialize(message);

                // Перевірка, чи JSON не порожній і валідний
                if (string.IsNullOrWhiteSpace(jsonString))
                {
                    throw new ArgumentException("Serialized JSON is empty or null.");
                }

                //ShowDebugMessage($"Sending JSON: {jsonString}"); // Логування JSON перед відправкою

                // Відправка як рядок
                webView.CoreWebView2.PostWebMessageAsString(jsonString);
            }
            catch (JsonException jsonEx)
            {
                ShowDebugMessage($"JSON Serialization Error: {jsonEx.Message}");
            }
            catch (ArgumentException argEx)
            {
                ShowDebugMessage($"Argument Error in PostWebMessageAsString: {argEx.Message}");
            }
            catch (Exception ex)
            {
                ShowDebugMessage($"Unexpected Error in ValidateAndSendMessage: {ex.Message}");
            }
        }


        private async Task HandleTradeSearch(string payload)
        {
            try
            {
                var apiUrl = "https://www.pathofexile.com/api/trade2/search/poe2/Standard";
                var content = new StringContent(payload, Encoding.UTF8, "application/json");

                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0");
                _httpClient.DefaultRequestHeaders.CacheControl = new CacheControlHeaderValue
                {
                    NoCache = true,
                    NoStore = true,
                    MustRevalidate = true
                };

                _httpClient.DefaultRequestHeaders.Pragma.Add(new NameValueHeaderValue("no-cache"));

                var response = await _httpClient.PostAsync(apiUrl, content);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    ShowDebugMessage($"Search API Error: {response.StatusCode}\nDetails: {errorContent}");
                    return;
                }

                var searchResult = await response.Content.ReadAsStringAsync();
                var searchData = JsonSerializer.Deserialize<JsonElement>(searchResult);

                var id = searchData.GetProperty("id").GetString();
                var result = searchData.GetProperty("result").EnumerateArray()
                                        .Take(10)
                                        .Select(x => x.GetString())
                                        .ToList();

                if (!result.Any())
                {
                    webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new
                    {
                        action = "tradeSearchResponse",
                        payload = new
                        {
                            result = new string[] { } // Empty array for "result"
                        },
                        link = $"https://www.pathofexile.com/trade2/search/poe2/Standard/{id}"
                    }));
                    return;
                }

                // Другий запит для fetch
                var fetchApiUrl = $"https://www.pathofexile.com/api/trade2/fetch/{string.Join(",", result)}?query={id}&realm=poe2";

                var fetchResponse = await _httpClient.GetAsync(fetchApiUrl);

                if (!fetchResponse.IsSuccessStatusCode)
                {
                    var fetchErrorContent = await fetchResponse.Content.ReadAsStringAsync();
                    ShowDebugMessage($"Fetch API Error: {fetchResponse.StatusCode}\nDetails: {fetchErrorContent}");
                    return;
                }

                var fetchResult = await fetchResponse.Content.ReadAsStringAsync();

                // Відправляємо результат назад у Angular
                webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new
                {
                    action = "tradeSearchResponse",
                    payload = fetchResult,
                    link = $"https://www.pathofexile.com/trade2/search/poe2/Standard/{id}"
                }));
            }
            catch (HttpRequestException httpEx)
            {
                ShowDebugMessage($"HTTP Error: {httpEx.Message}");
            }
            catch (Exception ex)
            {
                ShowDebugMessage($"General Error: {ex.Message}");
            }
        }

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

        private bool IsPathOfExileActive()
        {
            try
            {
                IntPtr foregroundWindow = GetForegroundWindow();
                GetWindowThreadProcessId(foregroundWindow, out uint processId);
                var process = Process.GetProcessById((int)processId);

                return process.ProcessName.Equals("PathOfExile", StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        }

        private void OpenUrlInBrowser(string url)
        {
            try
            {
                if (!string.IsNullOrWhiteSpace(url))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = url,
                        UseShellExecute = true
                    });
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to open URL in browser: {ex.Message}");
            }
        }

        private void ShowDebugMessage(string message)
        {
            #if DEBUG
                MessageBox.Show(message, "Debug Message", MessageBoxButton.OK, MessageBoxImage.Information);
            #else
                Console.WriteLine($"Debug Message: {message}");
            #endif
        }

    }
}
