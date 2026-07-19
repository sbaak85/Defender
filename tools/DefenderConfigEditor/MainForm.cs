using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace DefenderConfigEditor;

internal sealed class MainForm : Form
{
    private static readonly Color AppBack = Color.FromArgb(18, 24, 23);
    private static readonly Color PanelBack = Color.FromArgb(32, 40, 37);
    private static readonly Color CardBack = Color.FromArgb(41, 50, 46);
    private static readonly Color Gold = Color.FromArgb(224, 181, 91);
    private static readonly Color TextMain = Color.FromArgb(239, 239, 221);
    private static readonly Color TextMuted = Color.FromArgb(174, 190, 181);

    private readonly ConfigStore store;
    private JsonObject config;
    private readonly BufferedFlowLayoutPanel cardGrid = new();
    private readonly Label statusLabel = new();
    private readonly Button applyButton = new();
    private readonly Button applyAndExitButton = new();
    private readonly List<UnitCard> cards = new();
    private readonly System.Windows.Forms.Timer resizeDebounceTimer = new() { Interval = 90 };
    private int lastCardWidth = -1;
    private bool liveResizing;
    private bool dirty;
    private bool confirmedExit;

    internal static int RunSelfTest()
    {
        try
        {
            var testStore = ConfigStore.Discover();
            var before = testStore.Load();
            testStore.Apply(before);
            var after = testStore.Load();
            return before.ToJsonString() == after.ToJsonString() ? 0 : 2;
        }
        catch
        {
            return 1;
        }
    }

    internal bool ValidateCardActions()
    {
        CreateControl();
        PerformLayout();
        ResizeCards();
        cardGrid.PerformLayout();
        var units = config["units"]!.AsObject();
        var expectedCards = 1 + units["player"]!.AsObject().Count + units["enemy"]!.AsObject().Count;
        if (cards.Count != expectedCards) return false;
        foreach (var card in cards)
        {
            card.PerformLayout();
            var editButton = card.Controls.OfType<Button>().SingleOrDefault(button => button.Text == "修改");
            if (editButton is null || editButton.Top < 0 || editButton.Bottom > card.ClientSize.Height) return false;
        }
        return true;
    }

    public MainForm()
    {
        Text = "Defender Config Editor";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(1180, 720);
        Size = new Size(1460, 900);
        BackColor = AppBack;
        ForeColor = TextMain;
        Font = new Font("Microsoft JhengHei UI", 10F, FontStyle.Regular, GraphicsUnit.Point);
        DoubleBuffered = true;
        SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint, true);

        try
        {
            store = ConfigStore.Discover();
            config = store.Load();
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Config 載入失敗", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Shown += (_, _) => Close();
            store = null!;
            config = new JsonObject();
            return;
        }

        BuildHeader();
        BuildActions();
        BuildCardGrid();
        resizeDebounceTimer.Tick += (_, _) =>
        {
            resizeDebounceTimer.Stop();
            if (!liveResizing) ResizeCards();
        };
        ResizeBegin += (_, _) =>
        {
            liveResizing = true;
            resizeDebounceTimer.Stop();
            cardGrid.SuspendLayout();
        };
        ResizeEnd += (_, _) =>
        {
            liveResizing = false;
            cardGrid.ResumeLayout(false);
            ResizeCards(force: true);
        };
        Resize += (_, _) => QueueCardResize();
        FormClosing += HandleFormClosing;
        FormClosed += (_, _) => resizeDebounceTimer.Dispose();
        Shown += (_, _) => ResizeCards(force: true);
    }

    private void BuildHeader()
    {
        var header = new Panel
        {
            Dock = DockStyle.Top,
            Height = 82,
            Padding = new Padding(22, 12, 22, 8),
            BackColor = Color.FromArgb(24, 31, 29)
        };
        var title = new Label
        {
            AutoSize = true,
            Text = "DEFENDER  單位平衡編輯器",
            ForeColor = Gold,
            Font = new Font(Font.FontFamily, 18F, FontStyle.Bold),
            Location = new Point(20, 11)
        };
        var subtitle = new Label
        {
            AutoEllipsis = true,
            Text = $"修改會先保留在編輯器中；按下套用後才寫入  {store.ConfigJsonPath}",
            ForeColor = TextMuted,
            Location = new Point(22, 49),
            Size = new Size(1100, 24),
            Anchor = AnchorStyles.Left | AnchorStyles.Top | AnchorStyles.Right
        };
        header.Controls.Add(title);
        header.Controls.Add(subtitle);
        Controls.Add(header);
    }

    private void BuildActions()
    {
        var actions = new Panel
        {
            Dock = DockStyle.Bottom,
            Height = 78,
            Padding = new Padding(18),
            BackColor = Color.FromArgb(23, 30, 28)
        };
        statusLabel.Text = "尚未修改";
        statusLabel.ForeColor = TextMuted;
        statusLabel.AutoSize = true;
        statusLabel.Location = new Point(22, 29);

        StylePrimaryButton(applyButton, "套用", new Size(132, 44));
        StylePrimaryButton(applyAndExitButton, "確認離開", new Size(150, 44));
        applyButton.Click += (_, _) => ApplyChanges(false);
        applyAndExitButton.Click += (_, _) => ApplyChanges(true);

        actions.Controls.Add(statusLabel);
        actions.Controls.Add(applyButton);
        actions.Controls.Add(applyAndExitButton);
        actions.Layout += (_, _) =>
        {
            applyAndExitButton.Location = new Point(actions.ClientSize.Width - applyAndExitButton.Width - 22, 17);
            applyButton.Location = new Point(applyAndExitButton.Left - applyButton.Width - 12, 17);
        };
        Controls.Add(actions);
    }

    private void BuildCardGrid()
    {
        cardGrid.Dock = DockStyle.Fill;
        cardGrid.AutoScroll = true;
        cardGrid.WrapContents = true;
        cardGrid.FlowDirection = FlowDirection.LeftToRight;
        cardGrid.Padding = new Padding(12);
        cardGrid.BackColor = AppBack;

        foreach (var unit in EnumerateUnits())
        {
            var card = new UnitCard(unit, store.ProjectRoot, EditUnit)
            {
                Margin = new Padding(7)
            };
            cards.Add(card);
            cardGrid.Controls.Add(card);
        }
        Controls.Add(cardGrid);
        cardGrid.BringToFront();
    }

    private IEnumerable<UnitRef> EnumerateUnits()
    {
        var units = config["units"]!.AsObject();
        yield return new UnitRef("wall", "wall", units, units["wall"]!.AsObject());
        var players = units["player"]!.AsObject();
        foreach (var pair in players) yield return new UnitRef("player", pair.Key, players, pair.Value!.AsObject());
        var enemies = units["enemy"]!.AsObject();
        foreach (var pair in enemies) yield return new UnitRef("enemy", pair.Key, enemies, pair.Value!.AsObject());
    }

    private void QueueCardResize()
    {
        if (liveResizing) return;
        resizeDebounceTimer.Stop();
        resizeDebounceTimer.Start();
    }

    private void ResizeCards(bool force = false)
    {
        if (cards.Count == 0) return;
        const int columns = 6;
        var margins = columns * 14;
        var usable = cardGrid.ClientSize.Width - cardGrid.Padding.Horizontal - margins - SystemInformation.VerticalScrollBarWidth - 4;
        var width = Math.Max(168, usable / columns);
        if (!force && width == lastCardWidth) return;
        lastCardWidth = width;

        cardGrid.SuspendLayout();
        try
        {
            foreach (var card in cards)
            {
                if (card.Width == width && card.Height == 348) continue;
                card.Size = new Size(width, 348);
            }
        }
        finally
        {
            cardGrid.ResumeLayout(true);
        }
    }

    private void EditUnit(UnitCard card, UnitRef unit)
    {
        using var editor = new UnitEditorForm(unit);
        PositionEditor(editor, card);
        if (editor.ShowDialog(this) != DialogResult.OK || editor.UpdatedUnit is null) return;
        unit.Parent[unit.Id] = editor.UpdatedUnit;
        unit.Node = editor.UpdatedUnit;
        card.RefreshFrom(unit);
        SetDirty(true, $"已暫存：{unit.DisplayName}（尚未寫入 Config）");
    }

    private void PositionEditor(Form editor, Control card)
    {
        var cardTopLeft = card.PointToScreen(Point.Empty);
        var cardRect = new Rectangle(cardTopLeft, card.Size);
        var mainRect = RectangleToScreen(ClientRectangle);
        var working = Screen.FromControl(this).WorkingArea;
        editor.StartPosition = FormStartPosition.Manual;
        var placeRight = cardRect.Left + cardRect.Width / 2 < mainRect.Left + mainRect.Width / 2;
        var x = placeRight ? cardRect.Right + 8 : cardRect.Left - editor.Width - 8;
        var y = Math.Max(working.Top + 8, Math.Min(cardRect.Top, working.Bottom - editor.Height - 8));
        x = Math.Max(working.Left + 8, Math.Min(x, working.Right - editor.Width - 8));
        editor.Location = new Point(x, y);
    }

    private void ApplyChanges(bool exitAfter)
    {
        try
        {
            store.Apply(config);
            SetDirty(false, $"已套用：{DateTime.Now:HH:mm:ss}　（已同步 game-config.json 與 game-config.js）");
            if (!exitAfter) return;
            confirmedExit = true;
            Close();
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "寫入 Config 失敗", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void SetDirty(bool value, string message)
    {
        dirty = value;
        statusLabel.Text = message;
        statusLabel.ForeColor = value ? Color.FromArgb(255, 204, 105) : Color.FromArgb(132, 221, 171);
        Text = value ? "Defender Config Editor  *尚未套用" : "Defender Config Editor";
    }

    private void HandleFormClosing(object? sender, FormClosingEventArgs e)
    {
        if (confirmedExit || !dirty) return;
        var result = MessageBox.Show(
            "目前有尚未套用的修改。\n\n是：套用後離開\n否：放棄修改並離開\n取消：回到編輯器",
            "尚未套用",
            MessageBoxButtons.YesNoCancel,
            MessageBoxIcon.Warning);
        if (result == DialogResult.Cancel) e.Cancel = true;
        else if (result == DialogResult.Yes)
        {
            e.Cancel = true;
            BeginInvoke(() => ApplyChanges(true));
        }
    }

    private static void StylePrimaryButton(Button button, string text, Size size)
    {
        button.Text = text;
        button.Size = size;
        button.FlatStyle = FlatStyle.Flat;
        button.FlatAppearance.BorderColor = Color.FromArgb(181, 139, 64);
        button.FlatAppearance.BorderSize = 1;
        button.BackColor = Color.FromArgb(89, 65, 30);
        button.ForeColor = Color.FromArgb(255, 236, 181);
        button.Font = new Font("Microsoft JhengHei UI", 11F, FontStyle.Bold);
        button.Cursor = Cursors.Hand;
    }

    internal sealed class UnitRef
    {
        public UnitRef(string group, string id, JsonObject parent, JsonObject node)
        {
            Group = group;
            Id = id;
            Parent = parent;
            Node = node;
        }

        public string Group { get; }
        public string Id { get; }
        public JsonObject Parent { get; }
        public JsonObject Node { get; set; }
        public string DisplayName => Node["displayName"]?.GetValue<string>() ?? Id;
    }

    private sealed class UnitCard : Panel
    {
        private readonly string projectRoot;
        private readonly Action<UnitCard, UnitRef> editAction;
        private UnitRef unit;
        private readonly PictureBox thumbnail = new();
        private readonly Label nameLabel = new();
        private readonly Label factionLabel = new();
        private readonly Dictionary<string, Label> values = new();

        public UnitCard(UnitRef unit, string projectRoot, Action<UnitCard, UnitRef> editAction)
        {
            this.unit = unit;
            this.projectRoot = projectRoot;
            this.editAction = editAction;
            BackColor = CardBack;
            Padding = new Padding(10);
            DoubleBuffered = true;
            Build();
            RefreshFrom(unit);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using var pen = new Pen(Color.FromArgb(116, 101, 67));
            e.Graphics.DrawRectangle(pen, 0, 0, Width - 1, Height - 1);
        }

        private void Build()
        {
            thumbnail.Location = new Point(12, 12);
            thumbnail.Size = new Size(68, 68);
            thumbnail.SizeMode = PictureBoxSizeMode.Zoom;
            thumbnail.BackColor = Color.FromArgb(18, 25, 23);

            nameLabel.Location = new Point(90, 18);
            nameLabel.Size = new Size(112, 28);
            nameLabel.Font = new Font(Font.FontFamily, 13F, FontStyle.Bold);
            nameLabel.ForeColor = Gold;

            factionLabel.Location = new Point(90, 49);
            factionLabel.Size = new Size(105, 22);
            factionLabel.ForeColor = TextMuted;

            Controls.Add(thumbnail);
            Controls.Add(nameLabel);
            Controls.Add(factionLabel);

            var rows = new[]
            {
                ("attackDamage", "攻擊傷害"),
                ("attackRange", "攻擊距離"),
                ("attackInterval", "攻擊速度"),
                ("maxHp", "生命血量"),
                ("resourceCost", "花費資源")
            };
            var y = 97;
            foreach (var (key, title) in rows)
            {
                var label = new Label
                {
                    Text = title,
                    Location = new Point(14, y),
                    Size = new Size(88, 28),
                    ForeColor = TextMuted
                };
                var value = new Label
                {
                    TextAlign = ContentAlignment.MiddleRight,
                    Location = new Point(100, y),
                    Size = new Size(94, 28),
                    Font = new Font(Font.FontFamily, 11F, FontStyle.Bold),
                    ForeColor = TextMain,
                    Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right
                };
                values[key] = value;
                Controls.Add(label);
                Controls.Add(value);
                y += 38;
            }

            var editButton = new Button
            {
                Text = "修改",
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(52, 79, 67),
                ForeColor = Color.FromArgb(215, 244, 229),
                Dock = DockStyle.Bottom,
                Height = 37,
                Cursor = Cursors.Hand
            };
            editButton.FlatAppearance.BorderColor = Color.FromArgb(97, 154, 129);
            editButton.Click += (_, _) => editAction(this, unit);
            Controls.Add(editButton);
        }

        public void RefreshFrom(UnitRef refreshed)
        {
            unit = refreshed;
            nameLabel.Text = unit.DisplayName;
            factionLabel.Text = unit.Group switch
            {
                "player" => "我方單位",
                "enemy" => "敵方單位",
                _ => "防禦建築"
            };
            values["attackDamage"].Text = FormatNumber(unit.Node, "attackDamage");
            values["attackRange"].Text = $"{FormatNumber(unit.Node, "attackRange")} 格";
            values["attackInterval"].Text = $"{FormatNumber(unit.Node, "attackInterval")} 秒/次";
            values["maxHp"].Text = FormatNumber(unit.Node, "maxHp");
            values["resourceCost"].Text = FormatNumber(unit.Node, "resourceCost");
            LoadThumbnail();
        }

        private void LoadThumbnail()
        {
            thumbnail.Image?.Dispose();
            thumbnail.Image = null;
            var thumbnailRelative = unit.Group switch
            {
                "wall" => "assets/processed/config-editor-thumbnails/wall.png",
                "player" => $"assets/processed/config-editor-thumbnails/player-{unit.Id}.png",
                _ => $"assets/processed/config-editor-thumbnails/enemy-{unit.Id}.png"
            };
            var sourceRelative = unit.Group switch
            {
                "wall" => "assets/generated/dungeon-player-wall-6slot-v2.png",
                "player" => $"assets/processed/icons/player-{unit.Id}-icon-45.png",
                _ => $"assets/processed/enemy-{unit.Id}.png"
            };
            var thumbnailPath = Path.Combine(projectRoot, thumbnailRelative.Replace('/', Path.DirectorySeparatorChar));
            var sourcePath = Path.Combine(projectRoot, sourceRelative.Replace('/', Path.DirectorySeparatorChar));
            var path = File.Exists(thumbnailPath) ? thumbnailPath : sourcePath;
            if (!File.Exists(path)) return;
            using var source = Image.FromFile(path);
            thumbnail.Image = new Bitmap(source);
        }

        private static string FormatNumber(JsonObject node, string key)
        {
            var value = node[key]?.GetValue<decimal>() ?? 0;
            return value == decimal.Truncate(value) ? value.ToString("0", CultureInfo.InvariantCulture) : value.ToString("0.##", CultureInfo.InvariantCulture);
        }
    }

    private sealed class BufferedFlowLayoutPanel : FlowLayoutPanel
    {
        public BufferedFlowLayoutPanel()
        {
            DoubleBuffered = true;
            ResizeRedraw = false;
            SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint, true);
            UpdateStyles();
        }
    }

    private sealed class UnitEditorForm : Form
    {
        private readonly JsonObject working;
        private readonly Dictionary<string, Control> fields = new();
        private readonly TableLayoutPanel table = new();
        public JsonObject? UpdatedUnit { get; private set; }

        public UnitEditorForm(UnitRef unit)
        {
            working = JsonNode.Parse(unit.Node.ToJsonString())!.AsObject();
            Text = $"修改｜{unit.DisplayName}";
            Size = new Size(480, 790);
            MinimumSize = new Size(440, 640);
            BackColor = PanelBack;
            ForeColor = TextMain;
            Font = new Font("Microsoft JhengHei UI", 9.5F);
            FormBorderStyle = FormBorderStyle.SizableToolWindow;
            ShowInTaskbar = false;

            table.Dock = DockStyle.Fill;
            table.AutoScroll = true;
            table.Padding = new Padding(14);
            table.ColumnCount = 2;
            table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 145));
            table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            Controls.Add(table);

            AddSection("基本資料");
            AddText("displayName", "單位名稱");
            AddText("glyph", "備用符號");
            AddReadOnly("faction", "陣營");

            AddSection("戰鬥與經濟");
            AddNumber("attackDamage", "攻擊傷害");
            AddNumber("attackRange", "攻擊距離（格）");
            if (unit.Group == "enemy") AddProbability("stopAtMaxRangeChance", "最大射程停下機率 (0~1)");
            AddNumber("attackInterval", "攻擊速度（秒/次）", 2, 0.05M);
            AddNumber("maxHp", "生命血量");
            AddNumber("resourceCost", "花費資源");
            AddNumber("killReward", "擊殺獲得資源");
            AddNumber("moveInterval", "移動一格秒數", 2, 0.05M);
            AddNumber("repairCost", "維修價格");
            AddNumber("repairAmount", "維修回復血量");
            AddNumber("splashDamage", "濺射傷害");
            AddNumber("unlockLevel", "解鎖關卡");
            AddNumber("scoreValue", "擊殺分數");

            AddSection("占格與範圍");
            AddNestedNumber("footprint.columns", "占用格位－橫向", "footprint", "columns");
            AddNestedNumber("footprint.rows", "占用格位－縱向", "footprint", "rows");
            AddNestedNumber("splashArea.columns", "濺射範圍－橫向", "splashArea", "columns");
            AddNestedNumber("splashArea.rows", "濺射範圍－縱向", "splashArea", "rows");
            AddText("attackType", "攻擊類型");
            AddText("targetMode", "索敵方式");
            AddBoolean("canOverlapAtWall", "城牆前允許重疊");

            AddSection("音效（路徑 | Volume；逗號＝隨機抽1；加號＝同時播放）");
            AddAudioChance();
            AddAudioList("audio.cast.files", "單位出招音檔", "cast");
            AddAudioList("audio.attack", "單位攻擊音檔", "attack");
            AddAudioList("audio.impact", "命中目標音檔", "impact");
            AddAudioList("audio.death", "單位陣亡音檔", "death");
            if (unit.Group == "player")
            {
                AddAudioList("audio.deploy", "部署成功音檔", "deploy");
                AddAudioList("audio.move", "移動至空格成功音檔", "move");
                AddAudioList("audio.swap", "換位成功音檔", "swap");
            }

            var saveButton = new Button
            {
                Text = "儲存至編輯器",
                Height = 44,
                Dock = DockStyle.Fill,
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(89, 65, 30),
                ForeColor = Color.FromArgb(255, 236, 181),
                Font = new Font(Font.FontFamily, 11F, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            saveButton.FlatAppearance.BorderColor = Color.FromArgb(181, 139, 64);
            saveButton.Click += (_, _) => SaveWorkingCopy();
            AddFullRow(saveButton, 58);
        }

        private void AddSection(string title)
        {
            var label = new Label
            {
                Text = title,
                AutoSize = false,
                Height = 34,
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.BottomLeft,
                ForeColor = Gold,
                Font = new Font(Font.FontFamily, 11F, FontStyle.Bold)
            };
            AddFullRow(label, 40);
        }

        private void AddText(string key, string label)
        {
            var control = new TextBox { Text = working[key]?.GetValue<string>() ?? "", Dock = DockStyle.Fill };
            fields[key] = control;
            AddRow(label, control, 34);
        }

        private void AddReadOnly(string key, string label)
        {
            var control = new TextBox { Text = working[key]?.GetValue<string>() ?? "", Dock = DockStyle.Fill, ReadOnly = true, BackColor = Color.FromArgb(51, 58, 55) };
            fields[key] = control;
            AddRow(label, control, 34);
        }

        private void AddNumber(string key, string label, int decimals = 2, decimal increment = 1M)
        {
            var control = CreateNumber(working[key]?.GetValue<decimal>() ?? 0, decimals, increment);
            fields[key] = control;
            AddRow(label, control, 34);
        }

        private void AddProbability(string key, string label)
        {
            var control = CreateNumber(working[key]?.GetValue<decimal>() ?? 0, 2, 0.05M);
            control.Maximum = 1;
            fields[key] = control;
            AddRow(label, control, 34);
        }

        private void AddNestedNumber(string fieldKey, string label, string objectKey, string valueKey)
        {
            var nested = working[objectKey]!.AsObject();
            var control = CreateNumber(nested[valueKey]?.GetValue<decimal>() ?? 0, 0, 1);
            fields[fieldKey] = control;
            AddRow(label, control, 34);
        }

        private void AddBoolean(string key, string label)
        {
            var control = new CheckBox
            {
                Checked = working[key]?.GetValue<bool>() ?? false,
                Text = "啟用",
                ForeColor = TextMain,
                Dock = DockStyle.Fill
            };
            fields[key] = control;
            AddRow(label, control, 34);
        }

        private void AddAudioChance()
        {
            var cast = working["audio"]!["cast"]!.AsObject();
            var control = CreateNumber(cast["chance"]?.GetValue<decimal>() ?? 0, 2, 0.05M);
            control.Maximum = 1;
            fields["audio.cast.chance"] = control;
            AddRow("出招音檔機率（0～1）", control, 34);
        }

        private void AddAudioList(string fieldKey, string label, string channel)
        {
            var audio = working["audio"]!.AsObject();
            JsonArray list;
            if (channel == "cast") list = audio["cast"]!["files"]!.AsArray();
            else list = audio[channel]?.AsArray() ?? new JsonArray();
            var lines = list.Select(item =>
            {
                var sample = item!.AsObject();
                var path = sample["path"]?.GetValue<string>() ?? "";
                var volume = sample["volume"]?.GetValue<decimal>() ?? 1;
                return $"{path} | {volume.ToString("0.##", CultureInfo.InvariantCulture)}";
            }).ToList();
            var mode = GetAudioMode(audio, channel);
            var separator = mode == "all" ? " +" : " ,";
            for (var index = 0; index < lines.Count - 1; index++) lines[index] += separator;
            var control = new TextBox
            {
                Text = string.Join(Environment.NewLine, lines),
                Multiline = true,
                ScrollBars = ScrollBars.Vertical,
                AcceptsReturn = true,
                Dock = DockStyle.Fill
            };
            fields[fieldKey] = control;
            AddRow($"{label}（{(mode == "all" ? "同時播放 +" : "隨機抽1 ,")}）", control, 86);
        }

        private static string GetAudioMode(JsonObject audio, string channel)
        {
            var configured = channel == "cast"
                ? audio["cast"]?["mode"]?.GetValue<string>()
                : audio[$"{channel}Mode"]?.GetValue<string>();
            if (configured is "all" or "random") return configured;
            return channel == "impact" ? "all" : "random";
        }

        private static NumericUpDown CreateNumber(decimal value, int decimals, decimal increment)
        {
            return new NumericUpDown
            {
                DecimalPlaces = decimals,
                Increment = increment,
                Minimum = 0,
                Maximum = 100000,
                Value = Math.Max(0, Math.Min(100000, value)),
                ThousandsSeparator = true,
                Dock = DockStyle.Fill
            };
        }

        private void AddRow(string labelText, Control control, int height)
        {
            var row = table.RowCount++;
            table.RowStyles.Add(new RowStyle(SizeType.Absolute, height));
            var label = new Label
            {
                Text = labelText,
                ForeColor = TextMuted,
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleLeft,
                Padding = new Padding(0, 0, 8, 0)
            };
            control.Margin = new Padding(2, 4, 2, 4);
            table.Controls.Add(label, 0, row);
            table.Controls.Add(control, 1, row);
        }

        private void AddFullRow(Control control, int height)
        {
            var row = table.RowCount++;
            table.RowStyles.Add(new RowStyle(SizeType.Absolute, height));
            table.Controls.Add(control, 0, row);
            table.SetColumnSpan(control, 2);
        }

        private void SaveWorkingCopy()
        {
            try
            {
                working["displayName"] = ((TextBox)fields["displayName"]).Text.Trim();
                working["glyph"] = ((TextBox)fields["glyph"]).Text;
                foreach (var key in new[] { "attackDamage", "attackRange", "attackInterval", "maxHp", "resourceCost", "killReward", "moveInterval", "repairCost", "repairAmount", "splashDamage", "unlockLevel", "scoreValue" })
                    working[key] = ((NumericUpDown)fields[key]).Value;
                if (fields.TryGetValue("stopAtMaxRangeChance", out var stopChanceControl))
                    working["stopAtMaxRangeChance"] = ((NumericUpDown)stopChanceControl).Value;

                var footprint = working["footprint"]!.AsObject();
                footprint["columns"] = ((NumericUpDown)fields["footprint.columns"]).Value;
                footprint["rows"] = ((NumericUpDown)fields["footprint.rows"]).Value;
                var splashArea = working["splashArea"]!.AsObject();
                splashArea["columns"] = ((NumericUpDown)fields["splashArea.columns"]).Value;
                splashArea["rows"] = ((NumericUpDown)fields["splashArea.rows"]).Value;
                working["attackType"] = ((TextBox)fields["attackType"]).Text.Trim();
                working["targetMode"] = ((TextBox)fields["targetMode"]).Text.Trim();
                working["canOverlapAtWall"] = ((CheckBox)fields["canOverlapAtWall"]).Checked;

                var audio = working["audio"]!.AsObject();
                var cast = audio["cast"]!.AsObject();
                cast["chance"] = ((NumericUpDown)fields["audio.cast.chance"]).Value;
                SaveAudioList(audio, "cast", "audio.cast.files");
                SaveAudioList(audio, "attack", "audio.attack");
                SaveAudioList(audio, "impact", "audio.impact");
                SaveAudioList(audio, "death", "audio.death");
                if (fields.TryGetValue("audio.deploy", out var deployAudioControl))
                    SaveAudioList(audio, "deploy", "audio.deploy");
                if (fields.TryGetValue("audio.move", out var moveAudioControl))
                    SaveAudioList(audio, "move", "audio.move");
                if (fields.TryGetValue("audio.swap", out var swapAudioControl))
                    SaveAudioList(audio, "swap", "audio.swap");

                UpdatedUnit = working;
                DialogResult = DialogResult.OK;
                Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "參數格式錯誤", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void SaveAudioList(JsonObject audio, string channel, string fieldKey)
        {
            var fallbackMode = GetAudioMode(audio, channel);
            var parsed = ParseAudioList(((TextBox)fields[fieldKey]).Lines, fallbackMode);
            if (channel == "cast")
            {
                var cast = audio["cast"]!.AsObject();
                cast["files"] = parsed.Files;
                cast["mode"] = parsed.Mode;
            }
            else
            {
                audio[channel] = parsed.Files;
                audio[$"{channel}Mode"] = parsed.Mode;
            }
        }

        private static (JsonArray Files, string Mode) ParseAudioList(IEnumerable<string> lines, string fallbackMode)
        {
            var result = new JsonArray();
            var entries = lines.Select(raw => raw.Trim()).Where(line => line.Length > 0).ToList();
            string? detectedMode = null;
            for (var index = 0; index < entries.Count; index++)
            {
                var line = entries[index];
                var marker = line[^1];
                if (marker is ',' or '+')
                {
                    var lineMode = marker == '+' ? "all" : "random";
                    if (detectedMode is not null && detectedMode != lineMode)
                        throw new FormatException("同一音效事件不能混用逗號與加號。請統一使用 ,（隨機抽1）或 +（同時播放）。");
                    detectedMode = lineMode;
                    line = line[..^1].TrimEnd();
                }
                else if (index < entries.Count - 1)
                {
                    throw new FormatException($"音效之間缺少播放符號：{line}\n請在行尾加入 ,（隨機抽1）或 +（同時播放）。");
                }
                var splitAt = line.LastIndexOf('|');
                if (splitAt <= 0) throw new FormatException($"音效格式錯誤：{line}\n正確格式為：音檔路徑 | Volume");
                var path = line[..splitAt].Trim();
                var volumeText = line[(splitAt + 1)..].Trim();
                if (!decimal.TryParse(volumeText, NumberStyles.Number, CultureInfo.InvariantCulture, out var volume) || volume < 0 || volume > 1)
                    throw new FormatException($"Volume 必須介於 0～1：{line}");
                result.Add(new JsonObject { ["path"] = path, ["volume"] = volume });
            }
            return (result, detectedMode ?? fallbackMode);
        }
    }

    private sealed class ConfigStore
    {
        private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
        private static readonly UTF8Encoding Utf8NoBom = new(false);

        private ConfigStore(string projectRoot)
        {
            ProjectRoot = projectRoot;
            ConfigJsonPath = Path.Combine(projectRoot, "game-config.json");
            ConfigJsPath = Path.Combine(projectRoot, "game-config.js");
        }

        public string ProjectRoot { get; }
        public string ConfigJsonPath { get; }
        public string ConfigJsPath { get; }

        public static ConfigStore Discover()
        {
            foreach (var start in new[] { AppContext.BaseDirectory, Environment.CurrentDirectory })
            {
                var directory = new DirectoryInfo(start);
                for (var depth = 0; directory is not null && depth < 8; depth++, directory = directory.Parent)
                {
                    if (File.Exists(Path.Combine(directory.FullName, "game-config.json"))) return new ConfigStore(directory.FullName);
                }
            }
            throw new FileNotFoundException("找不到 game-config.json。請將 Defender-Config-Editor.exe 放在 Defender 專案資料夾內執行。");
        }

        public JsonObject Load()
        {
            var text = File.ReadAllText(ConfigJsonPath, Encoding.UTF8);
            var root = JsonNode.Parse(text)?.AsObject() ?? throw new InvalidDataException("game-config.json 內容無效");
            if (root["units"]?["wall"] is null || root["units"]?["player"] is null || root["units"]?["enemy"] is null)
                throw new InvalidDataException("game-config.json 缺少 units.wall、units.player 或 units.enemy");
            return root;
        }

        public void Apply(JsonObject root)
        {
            var json = root.ToJsonString(JsonOptions) + Environment.NewLine;
            var js = "/* Generated from game-config.json by Defender Config Editor. */\r\n" +
                     "/* Edit with Defender-Config-Editor.exe to keep both files synchronized. */\r\n" +
                     "window.DEFENDER_CONFIG = " + root.ToJsonString(JsonOptions) + ";\r\n";

            var backupDir = Path.Combine(ProjectRoot, "config-backups");
            Directory.CreateDirectory(backupDir);
            var stamp = DateTime.Now.ToString("yyyyMMdd-HHmmss-fff");
            if (File.Exists(ConfigJsonPath)) File.Copy(ConfigJsonPath, Path.Combine(backupDir, $"game-config-{stamp}.json"), true);
            if (File.Exists(ConfigJsPath)) File.Copy(ConfigJsPath, Path.Combine(backupDir, $"game-config-{stamp}.js"), true);

            AtomicWrite(ConfigJsonPath, json);
            AtomicWrite(ConfigJsPath, js);
        }

        private static void AtomicWrite(string path, string content)
        {
            var temporary = path + ".tmp";
            File.WriteAllText(temporary, content, Utf8NoBom);
            File.Move(temporary, path, true);
        }
    }
}
