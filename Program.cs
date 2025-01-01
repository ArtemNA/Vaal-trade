using System;
using System.Drawing;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using Hardcodet.Wpf.TaskbarNotification;

namespace PoeOverlayApp
{
    public class Program
    {
        private static TaskbarIcon _trayIcon;

        [STAThread]
        public static void Main()
        {
            try
            {
                // Ініціалізація WPF додатку
                var app = new Application();

                // Ініціалізація іконки в треї
                InitializeTrayIcon();

                // Відображення головного вікна
                var mainWindow = new MainWindow();
                mainWindow.Visibility = Visibility.Hidden;
                app.Run(mainWindow);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Fatal Error: {ex.Message}");
            }
            finally
            {
                // Очистка ресурсів трея
                _trayIcon?.Dispose();
            }
        }

        private static void InitializeTrayIcon()
        {
            _trayIcon = new TaskbarIcon
            {
                IconSource = new BitmapImage(new Uri("pack://application:,,,/app.ico", UriKind.Absolute)),
                ToolTipText = "PoeOverlayApp",
                MenuActivation = Hardcodet.Wpf.TaskbarNotification.PopupActivationMode.LeftClick,
                Visibility = System.Windows.Visibility.Visible,
                ContextMenu = new System.Windows.Controls.ContextMenu
                {
                    Items =
            {
                new System.Windows.Controls.MenuItem
                {
                    Header = "Show Window",
                    Command = new RelayCommand(_ => ShowMainWindow())
                },
                new System.Windows.Controls.MenuItem
                {
                    Header = "Exit",
                    Command = new RelayCommand(_ => ExitApplication())
                }
            }
                }
            };
        }

        private static void ShowMainWindow()
        {
            Application.Current.Dispatcher.Invoke(() =>
            {
                if (Application.Current.MainWindow == null)
                {
                    Application.Current.MainWindow = new MainWindow();
                }

                Application.Current.MainWindow.Show();
                Application.Current.MainWindow.Activate();
            });
        }

        private static void ExitApplication()
        {
            Application.Current.Dispatcher.Invoke(() =>
            {
                _trayIcon?.Dispose();
                Application.Current.Shutdown();
            });
        }
    }

    // Допоміжний клас для команд
    public class RelayCommand : System.Windows.Input.ICommand
    {
        private readonly Action<object> _execute;
        private readonly Predicate<object> _canExecute;

        public RelayCommand(Action<object> execute, Predicate<object> canExecute = null)
        {
            _execute = execute ?? throw new ArgumentNullException(nameof(execute));
            _canExecute = canExecute;
        }

        public bool CanExecute(object parameter) => _canExecute?.Invoke(parameter) ?? true;

        public void Execute(object parameter) => _execute(parameter);

        public event EventHandler CanExecuteChanged
        {
            add => CommandManager.RequerySuggested += value;
            remove => CommandManager.RequerySuggested -= value;
        }
    }
}
