namespace DefenderConfigEditor;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        if (args.Contains("--self-test", StringComparer.OrdinalIgnoreCase))
        {
            Environment.ExitCode = MainForm.RunSelfTest();
            return;
        }

        ApplicationConfiguration.Initialize();

        if (args.Contains("--self-test-ui", StringComparer.OrdinalIgnoreCase))
        {
            using var testForm = new MainForm();
            Environment.ExitCode = testForm.ValidateCardActions() ? 0 : 3;
            return;
        }

        Application.Run(new MainForm());
    }
}
