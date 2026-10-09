using System.Windows.Automation;
using IBrowse.Core;
using CoreRect = IBrowse.Core.Rect;

namespace IBrowse.Windows;

/// <summary>Turns the UI Automation element under a point into an <see cref="ElementInfo"/>.</summary>
internal static class UiaDescriber
{
    private const int MaxValueLength = 60;

    private static readonly Dictionary<string, string> Roles = new()
    {
        ["ControlType.Button"] = "button", ["ControlType.Hyperlink"] = "link",
        ["ControlType.CheckBox"] = "checkbox", ["ControlType.RadioButton"] = "radio",
        ["ControlType.Edit"] = "textbox", ["ControlType.ComboBox"] = "combobox",
        ["ControlType.List"] = "listbox", ["ControlType.Slider"] = "slider",
        ["ControlType.Spinner"] = "spinbutton", ["ControlType.TabItem"] = "tab",
        ["ControlType.MenuItem"] = "menuitem", ["ControlType.ListItem"] = "option",
        ["ControlType.Image"] = "image", ["ControlType.Text"] = "text",
        ["ControlType.Header"] = "heading",
    };

    private static readonly AutomationPattern[] ActionPatterns =
    [
        InvokePattern.Pattern, TogglePattern.Pattern, SelectionItemPattern.Pattern,
        ExpandCollapsePattern.Pattern, ValuePattern.Pattern, RangeValuePattern.Pattern,
    ];

    public static AutomationElement? ElementAt(int x, int y)
    {
        try { return AutomationElement.FromPoint(new System.Windows.Point(x, y)); }
        catch (Exception e) when (e is ElementNotAvailableException or InvalidOperationException) { return null; }
    }

    /// <summary>A key that stays the same while the pointer stays on one element.</summary>
    public static string KeyOf(AutomationElement el)
    {
        try { return $"{el.Current.ProcessId}-{string.Join('.', el.GetRuntimeId())}"; }
        catch (ElementNotAvailableException) { return "gone"; }
    }

    public static ElementInfo Describe(AutomationElement el)
    {
        var c = el.Current;
        var role = Roles.GetValueOrDefault(c.ControlType.ProgrammaticName, "text");
        var interactive = ActionPatterns.Any(p => Supports(el, p)) || role is "button" or "link";
        var info = new ElementInfo(role, c.Name ?? "", interactive ? Affordance.Interactive : Affordance.Static, Certainty.Sure)
        {
            Disabled = !c.IsEnabled,
            Required = c.IsRequiredForForm,
            Secret = c.IsPassword,
        };
        return info with { Checked = ToggleOf(el), Value = ValueOf(el, c.IsPassword) };
    }

    public static CoreRect BoundsOf(AutomationElement el)
    {
        var r = el.Current.BoundingRectangle;
        return r.IsEmpty ? new CoreRect(0, 0, 0, 0) : new CoreRect(r.Left, r.Top, r.Width, r.Height);
    }

    private static bool Supports(AutomationElement el, AutomationPattern pattern)
    {
        try { return el.TryGetCurrentPattern(pattern, out _); }
        catch (Exception e) when (e is ElementNotAvailableException or InvalidOperationException) { return false; }
    }

    private static TriState? ToggleOf(AutomationElement el)
    {
        if (!el.TryGetCurrentPattern(TogglePattern.Pattern, out var p)) return null;
        return ((TogglePattern)p).Current.ToggleState switch
        {
            ToggleState.On => TriState.On,
            ToggleState.Indeterminate => TriState.Mixed,
            _ => TriState.Off,
        };
    }

    /// <summary>A password is reported as filled or empty, never as its text.</summary>
    private static string? ValueOf(AutomationElement el, bool secret)
    {
        if (!el.TryGetCurrentPattern(ValuePattern.Pattern, out var p)) return null;
        var value = ((ValuePattern)p).Current.Value ?? "";
        if (secret) return value.Length == 0 ? "" : "filled";
        return value.Length > MaxValueLength ? value[..MaxValueLength] : value;
    }
}
