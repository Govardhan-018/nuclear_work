package app.lifeos.tracker;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Android 15 (targetSdk 35+) draws every app edge to edge and ignores the old
 * status bar colour APIs, so the WebView fills the whole display including the
 * area behind the status bar and the gesture/navigation bar.
 *
 * Rather than fight that, we keep the bars transparent and hand their measured
 * heights to the web layer as CSS custom properties. The page can then place
 * its own background behind the bars while keeping controls clear of them.
 * `env(safe-area-inset-*)` is not reliable for system bars in an Android
 * WebView, which is why the values are injected instead of inferred.
 */
public class MainActivity extends BridgeActivity {

    private int lastTop = -1;
    private int lastBottom = -1;
    private int lastLeft = -1;
    private int lastRight = -1;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must be registered before the bridge is created.
        registerPlugin(SessionNotificationPlugin.class);
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            // Pre-Android-15 these still apply; from 15 they are no-ops and the
            // bars are transparent by default.
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);
        }

        final View root = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());

            // When the keyboard is open it replaces the navigation bar inset.
            int bottom = Math.max(bars.bottom, ime.bottom);
            applyInsets(bars.top, bottom, bars.left, bars.right, ime.bottom > 0);
            return windowInsets;
        });
    }

    private void applyInsets(int top, int bottom, int left, int right, boolean keyboardOpen) {
        if (top == lastTop && bottom == lastBottom && left == lastLeft && right == lastRight) {
            return;
        }
        lastTop = top;
        lastBottom = bottom;
        lastLeft = left;
        lastRight = right;

        final WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;

        final float density = getResources().getDisplayMetrics().density;
        final String script = String.format(
            java.util.Locale.US,
            "(function(){var s=document.documentElement.style;" +
            "s.setProperty('--inset-top','%.1fpx');" +
            "s.setProperty('--inset-bottom','%.1fpx');" +
            "s.setProperty('--inset-left','%.1fpx');" +
            "s.setProperty('--inset-right','%.1fpx');" +
            "document.documentElement.classList.toggle('keyboard-open',%b);" +
            "window.dispatchEvent(new CustomEvent('safeareachange'));})();",
            top / density, bottom / density, left / density, right / density, keyboardOpen
        );

        webView.post(() -> webView.evaluateJavascript(script, null));
    }
}
