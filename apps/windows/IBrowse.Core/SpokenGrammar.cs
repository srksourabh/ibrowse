namespace IBrowse.Core;

/// <summary>
/// The spoken description of an element, in the same grammar as the browser
/// extension: "[Label] — [Role], Clickable" or "Text only". Short mode leaves
/// "Clickable" and "Text only" to the sound, but never drops a warning.
/// </summary>
public static class SpokenGrammar
{
    private const string Unlabeled = "Unlabeled";
    private const int LeadWords = 5;

    private static readonly Dictionary<string, string> RoleNames = new()
    {
        ["link"] = "Link", ["button"] = "Button", ["checkbox"] = "Checkbox", ["radio"] = "Radio button",
        ["textbox"] = "Edit text", ["searchbox"] = "Search box", ["combobox"] = "Combo box",
        ["listbox"] = "List box", ["slider"] = "Slider", ["spinbutton"] = "Spin button",
        ["switch"] = "Switch", ["tab"] = "Tab", ["menuitem"] = "Menu item", ["option"] = "Option",
    };

    private static readonly HashSet<string> EmptyableRoles = ["textbox", "searchbox"];

    public static string Text(ElementInfo info, bool shortMode = false)
    {
        var label = string.IsNullOrEmpty(info.Label) ? Unlabeled : info.Label;

        if (info.Role == "image") return ImageText(info);
        if (info.Affordance == Affordance.Interactive && info.Certainty == Certainty.Maybe)
            return $"{label} — May be clickable";
        if (info.Affordance == Affordance.Interactive) return $"{label} — {string.Join(", ", ControlParts(info, shortMode))}";
        if (info.Role == "paragraph" && info.Label.Length > 0) return ParagraphText(info.Label, shortMode);
        if (info.Role == "heading") return HeadingText(info, label, shortMode);
        if (info.Label.Length == 0) return "Text only";
        return shortMode ? info.Label : $"{info.Label} — Text only";
    }

    private static string ImageText(ElementInfo info) =>
        info.Label.Length > 0 ? $"{info.Label} — Image" : "Image, no description";

    private static string ParagraphText(string label, bool shortMode)
    {
        var lead = string.Join(' ', label.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Take(LeadWords))
            .TrimEnd('.', ',', ';', ':', '!', '?');
        return shortMode ? $"Paragraph: {lead}" : $"Paragraph: {lead}. Click to read.";
    }

    private static string HeadingText(ElementInfo info, string label, bool shortMode)
    {
        var parts = new List<string> { $"Heading level {info.HeadingLevel ?? 1}" };
        if (!shortMode) parts.Add("Text only");
        return $"{label} — {string.Join(", ", parts)}";
    }

    private static List<string> ControlParts(ElementInfo info, bool shortMode)
    {
        var parts = new List<string> { info.Secret ? "Password field" : RoleName(info.Role) };
        parts.AddRange(ValueWords(info));
        parts.AddRange(StateWords(info));
        if (info.Required) parts.Add("required");
        if (info.Disabled) parts.Add("Disabled");
        else if (!shortMode) parts.Add("Clickable");
        return parts;
    }

    private static string RoleName(string role) =>
        RoleNames.TryGetValue(role, out var name) ? name : char.ToUpperInvariant(role[0]) + role[1..];

    private static IEnumerable<string> ValueWords(ElementInfo info)
    {
        if (info.Value is null) return [];
        if (info.Value.Length == 0) return info.Secret || EmptyableRoles.Contains(info.Role) ? ["empty"] : [];
        return [info.Value];
    }

    private static IEnumerable<string> StateWords(ElementInfo info)
    {
        if (info.Checked is { } c) yield return Tri(c, "checked", "not checked");
        if (info.Pressed is { } p) yield return Tri(p, "pressed", "not pressed");
        if (info.Expanded is { } e) yield return e ? "expanded" : "collapsed";
        if (info.Selected is { } s) yield return s ? "selected" : "not selected";
    }

    private static string Tri(TriState value, string on, string off) =>
        value == TriState.Mixed ? $"partially {on}" : value == TriState.On ? on : off;
}
