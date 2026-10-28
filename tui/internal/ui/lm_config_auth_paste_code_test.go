package ui

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/ansi"

	"github.com/JaimeCernuda/gact-tui/contract/gact"
	"github.com/JaimeCernuda/gact-tui/tui/internal/client"
)

const pasteCodeTestURL = "https://auth.globus.org/v2/oauth2/authorize?client_id=58fdd3bc-e1c3-4ce5-80ea-8d6b87cfb944&response_type=code"

func newPasteCodeTestApp(t *testing.T) *App {
	t.Helper()
	a := newLMConfigTestApp()
	a.lmConfig.info.Presets = append(a.lmConfig.info.Presets, client.LMProviderPreset{
		ID:         "argonne_metis",
		Label:      "ALCF Metis",
		Provider:   "argonne",
		AuthMethod: "oauth",
		APIBase:    "https://inference-api.alcf.anl.gov/resource_server/metis/api/v1",
		Status:     "auth_required",
	})
	a.lmConfig.selected = len(a.lmConfig.info.Presets) - 1
	a.lmConfig.field = lmFieldAuth
	return a
}

func stubClipboard(t *testing.T) *[]string {
	t.Helper()
	copied := []string{}
	prev, prevOSC52 := clipboardWrite, osc52Write
	clipboardWrite = func(s string) error { copied = append(copied, s); return nil }
	osc52Write = func(string) error { return nil }
	t.Cleanup(func() { clipboardWrite, osc52Write = prev, prevOSC52 })
	return &copied
}

func TestLMConfigPasteCodeStartShowsLinkAndCodeBox(t *testing.T) {
	copied := stubClipboard(t)
	a := newPasteCodeTestApp(t)
	a.lmConfig.authenticating = true

	model, _ := a.Update(lmConfigAuthedMsg{
		providerID: "argonne_metis",
		resp: client.ProviderAuthResponse{
			ProviderID:   "argonne_metis",
			FlowID:       "flow-1",
			Browser:      &client.ProviderAuthBrowser{AuthorizationURL: pasteCodeTestURL},
			Instructions: "Continue in Globus Auth, then paste the authorization code here.",
		},
	})
	a = model.(*App)

	if a.lmConfig.authenticating {
		t.Fatal("authenticating should clear once the start reply arrives")
	}
	if a.lmConfig.field != lmFieldAuthCode {
		t.Fatalf("focus = %v, want the code box", a.lmConfig.field)
	}
	if len(*copied) != 1 || (*copied)[0] != pasteCodeTestURL {
		t.Fatalf("sign-in link should be copied to the clipboard, got %q", *copied)
	}
	found := false
	for _, f := range a.lmConfig.lmConfigVisibleFields() {
		found = found || f == lmFieldAuthCode
	}
	if !found {
		t.Fatal("a pending flow should expose the code field")
	}

	raw, _ := a.lmConfig.renderProviderDetailsRowsAndHits(60, 40)
	plain := ansi.Strip(strings.Join(raw, "\n"))
	if !strings.Contains(plain, "code:") {
		t.Fatalf("details should show the code box:\n%s", plain)
	}
	if !strings.Contains(strings.ReplaceAll(plain, "\n", ""), pasteCodeTestURL) {
		t.Fatalf("details should show the full sign-in URL:\n%s", plain)
	}
	if !strings.Contains(strings.Join(raw, ""), ansi.SetHyperlink(pasteCodeTestURL)) {
		t.Fatal("the link row should be an OSC8 hyperlink to the sign-in URL")
	}
}

func TestLMConfigPasteCodeEnterCompletesWithFlowAndCode(t *testing.T) {
	var got client.ProviderAuthRequest
	var path string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&got)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"is_authenticated":true,"instructions":"ALCF sign-in complete."}`))
	}))
	defer srv.Close()

	a := newPasteCodeTestApp(t)
	a.c = client.New(srv.URL)
	a.lmConfig.authFlowID = "flow-1"
	a.lmConfig.authFlowPreset = "argonne_metis"
	a.lmConfig.authURL = pasteCodeTestURL
	a.lmConfig.field = lmFieldAuthCode

	a.lmConfig.handleKey(tea.KeyPressMsg{Text: "abc"})
	a.lmConfig.handleKey(tea.KeyPressMsg{Code: tea.KeyBackspace})
	a.lmConfig.handlePaste(" c123\n")
	if a.lmConfig.authCode != "abc123" {
		t.Fatalf("authCode = %q", a.lmConfig.authCode)
	}

	_, cmd := a.lmConfig.handleKey(keyMsg("enter"))
	if cmd == nil || !a.lmConfig.authenticating {
		t.Fatal("Enter on the code box should dispatch the complete request")
	}
	msg := cmd().(lmConfigAuthedMsg)
	if msg.err != nil {
		t.Fatalf("complete request failed: %v", msg.err)
	}
	if path != "/v1/providers/argonne_metis/auth" || got.Action != "complete" ||
		got.FlowID != "flow-1" || got.AuthorizationCode != "abc123" {
		t.Fatalf("complete request = %s %+v", path, got)
	}

	model, _ := a.Update(msg)
	a = model.(*App)
	if a.lmConfig.authFlowPending() || a.lmConfig.authCode != "" {
		t.Fatal("a completed sign-in should clear the pending flow")
	}
	if p := a.lmConfig.info.Presets[a.lmConfig.selected]; !p.IsAuthenticated {
		t.Fatalf("completed sign-in should mark the provider authenticated: %#v", p)
	}
}

func TestLMConfigPasteCodeEmptyCodeDoesNotSubmit(t *testing.T) {
	a := newPasteCodeTestApp(t)
	a.lmConfig.authFlowID = "flow-1"
	a.lmConfig.authFlowPreset = "argonne_metis"
	a.lmConfig.field = lmFieldAuthCode

	if _, cmd := a.lmConfig.handleKey(keyMsg("enter")); cmd != nil {
		t.Fatal("an empty code must not be submitted")
	}
	if !strings.Contains(a.lmConfig.authMessage, "paste the authorization code") {
		t.Fatalf("authMessage = %q", a.lmConfig.authMessage)
	}
}

func TestLMConfigSignInRowsFitA24RowTerminal(t *testing.T) {
	a := newPasteCodeTestApp(t)
	a.width, a.height = 94, 24
	a.lmConfig.field = lmFieldPreset

	out := ansi.Strip(a.lmConfig.view())
	if !strings.Contains(out, "Authenticate") {
		t.Fatalf("a signed-out ALCF provider must show Authenticate at 94x24:\n%s", out)
	}

	a.lmConfig.authFlowID = "flow-1"
	a.lmConfig.authFlowPreset = "argonne_metis"
	a.lmConfig.authURL = pasteCodeTestURL
	a.lmConfig.field = lmFieldAuthCode
	out = ansi.Strip(a.lmConfig.view())
	if !strings.Contains(out, "code:") || !strings.Contains(out, "link: open Globus sign-in") {
		t.Fatalf("a pending sign-in must show the code box and link at 94x24:\n%s", out)
	}
}

func TestLMConfigSignedInProviderKeepsTheFullLayout(t *testing.T) {
	a := newPasteCodeTestApp(t)
	a.width, a.height = 94, 24
	p := &a.lmConfig.info.Presets[a.lmConfig.selected]
	p.IsAuthenticated, p.Status = true, "ready"

	if a.lmConfig.layout(84, a.lmConfig.bodyRows()).compact {
		t.Fatal("a signed-in provider should keep the model and config boxes")
	}
}

func TestLMConfigCtrlOShowsTheFullLinkOnlyWhilePending(t *testing.T) {
	a := newPasteCodeTestApp(t)
	ctrlO := tea.KeyPressMsg{Code: 'o', Mod: tea.ModCtrl}

	if _, cmd := a.lmConfig.handleKey(ctrlO); cmd != nil {
		t.Fatal("Ctrl+O without a pending sign-in should do nothing")
	}

	a.lmConfig.authFlowID = "flow-1"
	a.lmConfig.authFlowPreset = "argonne_metis"
	a.lmConfig.authURL = pasteCodeTestURL
	a.lmConfig.field = lmFieldAuthCode
	if _, cmd := a.lmConfig.handleKey(ctrlO); cmd == nil {
		t.Fatal("Ctrl+O with a pending sign-in should show the full link")
	}
	if a.lmConfig.authCode != "" {
		t.Fatalf("Ctrl+O must not type into the code box, got %q", a.lmConfig.authCode)
	}
	out := ansi.Strip(a.lmConfig.view())
	if !strings.Contains(out, "Ctrl+O: show full link to copy") {
		t.Fatalf("the pane should advertise Ctrl+O:\n%s", out)
	}
}

func TestLMConfigAuthLinkExecPrintsTheWholeURLOnOneLine(t *testing.T) {
	// A shell metacharacter in the URL must arrive verbatim, not be run.
	url := pasteCodeTestURL + "&state=$(echo pwned)&x=`id`"
	cmd := lmConfigAuthLinkExec(url, "ALCF Metis")
	cmd.Stdin = strings.NewReader("\n")
	out, err := cmd.Output()
	if err != nil {
		t.Fatalf("link view failed: %v\n%s", err, out)
	}
	lines := strings.Split(string(out), "\n")
	found := false
	for _, line := range lines {
		found = found || line == url
	}
	if !found {
		t.Fatalf("the full URL should be printed alone on one line:\n%s", out)
	}
	if !strings.Contains(string(out), "Sign in to ALCF Metis") {
		t.Fatalf("the link view should name the provider:\n%s", out)
	}
}

func signedInMetisWithModels(t *testing.T) *App {
	t.Helper()
	a := newPasteCodeTestApp(t)
	a.width, a.height = 94, 24
	p := &a.lmConfig.info.Presets[a.lmConfig.selected]
	p.IsAuthenticated, p.Status = true, "ready"
	a.lmConfig.modelCatalogs["argonne_metis"] = []gact.Model{
		{ID: "gemma-4-31B-it"}, {ID: "gpt-oss-120b"}, {ID: "Mistral-Large-3-675B-Instruct-2512"},
	}
	a.lmConfig.modelCatalogWarnings["argonne_metis"] = ""
	a.lmConfig.modelCatalogSources["argonne_metis"] = "live"
	a.lmConfig.model = "gemma-4-31B-it"
	a.lmConfig.modelIndex = 0
	a.lmConfig.field = lmFieldPreset
	return a
}

func TestLMConfigSignedInTabGoesStraightToModels(t *testing.T) {
	a := signedInMetisWithModels(t)

	a.lmConfig.handleKey(keyMsg("tab"))
	if a.lmConfig.field != lmFieldModel {
		t.Fatalf("Tab from the provider of a signed-in ALCF cluster focused %v, want the model list", a.lmConfig.field)
	}
	a.lmConfig.handleKey(keyMsg("down"))
	if a.lmConfig.model != "gpt-oss-120b" {
		t.Fatalf("Down in the model list selected %q, want gpt-oss-120b", a.lmConfig.model)
	}
}

func TestLMConfigSignedOutTabStillStopsAtAuthenticate(t *testing.T) {
	a := newPasteCodeTestApp(t)
	a.lmConfig.field = lmFieldPreset

	a.lmConfig.handleKey(keyMsg("tab"))
	if a.lmConfig.field != lmFieldAuth {
		t.Fatalf("Tab for a signed-out ALCF cluster focused %v, want Authenticate", a.lmConfig.field)
	}
}

func TestLMConfigCatalogReloadKeepsTheChosenModel(t *testing.T) {
	a := signedInMetisWithModels(t)
	a.lmConfig.info.Presets[a.lmConfig.selected].SuggestedModel = "gemma-4-31B-it"
	a.lmConfig.model = "gpt-oss-120b"

	a.lmConfig.handleModelsLoaded(lmConfigModelsLoadedMsg{
		presetID: "argonne_metis",
		models:   a.lmConfig.modelCatalogs["argonne_metis"],
		source:   "live",
	})
	if a.lmConfig.model != "gpt-oss-120b" {
		t.Fatalf("a catalog reload replaced the chosen model with %q", a.lmConfig.model)
	}
}
