package ru.voicenote.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.view.ViewTreeObserver;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.ProcessLifecycleOwner;
import com.getcapacitor.BridgeActivity;
import com.yandex.mobile.ads.appopenad.AppOpenAd;
import com.yandex.mobile.ads.appopenad.AppOpenAdEventListener;
import com.yandex.mobile.ads.appopenad.AppOpenAdLoadListener;
import com.yandex.mobile.ads.appopenad.AppOpenAdLoader;
import com.yandex.mobile.ads.banner.BannerAdEventListener;
import com.yandex.mobile.ads.banner.BannerAdSize;
import com.yandex.mobile.ads.banner.BannerAdView;
import com.yandex.mobile.ads.common.AdError;
import com.yandex.mobile.ads.common.AdRequest;
import com.yandex.mobile.ads.common.AdRequestError;
import com.yandex.mobile.ads.common.DefaultProcessLifecycleObserver;
import com.yandex.mobile.ads.common.ImpressionData;
import com.yandex.mobile.ads.common.YandexAds;

// NOTE: Yandex Mobile Ads SDK 8.0.0 (April 2026) introduced breaking API changes
// (AdRequestConfiguration removed, BannerAdView.setAdUnitId() removed,
// BannerAdSize.stickySize -> sticky, loaders now take the listener as a loadAd()
// parameter instead of a separate setAdLoadListener() call, BannerAdEventListener
// lost onLeftApplication/onReturnedToApplication). This file targets the SDK 8.0.0+
// API per https://ads.yandex.com/helpcenter/en/dev/android/release/8-0-0-migration

public class MainActivity extends BridgeActivity {

    private static final int PERMISSION_REQUEST_CODE = 1001;

    // Ad unit IDs from the Yandex Advertising Network partner interface
    // (Реклама в приложениях -> Голосовой блокнот).
    private static final String BANNER_AD_UNIT_ID = "R-M-19526722-2";
    private static final String APP_OPEN_AD_UNIT_ID = "R-M-19526722-1";

    @Nullable
    private BannerAdView bannerAdView;

    @Nullable
    private AppOpenAdLoader appOpenAdLoader;

    @Nullable
    private AppOpenAd appOpenAd;

    // Suppress the very first foreground event (the cold start itself) so the
    // app open ad never covers the splash screen / first launch, per Yandex's
    // own recommendation. It will show on subsequent hot starts.
    private boolean isFirstForegroundEvent = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestAudioPermissions();
        initYandexAds();
    }

    @Override
    protected void onDestroy() {
        if (bannerAdView != null) {
            bannerAdView.destroy();
        }
        clearAppOpenAd();
        super.onDestroy();
    }

    /**
     * Initializes the Yandex Mobile Ads (Mediation) SDK, then loads the ad units
     * once it's ready. The SDK also auto-initializes lazily before the first ad
     * request, but an explicit call on startup speeds up the first ad load.
     * See: https://ads.yandex.com/helpcenter/en/dev/android/quick-start#init
     */
    private void initYandexAds() {
        YandexAds.initialize(this, () -> {
            setupBannerAd();
            setupAppOpenAd();
        });
    }

    // ---- Adaptive sticky banner (R-M-19526722-2) ----------------------------
    // https://ads.yandex.com/helpcenter/en/dev/android/adaptive-sticky-banner

    private void setupBannerAd() {
        bannerAdView = findViewById(R.id.ad_container_view);
        if (bannerAdView == null) {
            return;
        }
        // Wait for the container to be laid out so we know its real width
        // before asking the SDK for the right adaptive banner size.
        bannerAdView.getViewTreeObserver().addOnGlobalLayoutListener(
            new ViewTreeObserver.OnGlobalLayoutListener() {
                @Override
                public void onGlobalLayout() {
                    if (bannerAdView == null) {
                        return;
                    }
                    bannerAdView.getViewTreeObserver().removeOnGlobalLayoutListener(this);
                    loadBannerAd(getBannerAdSize());
                }
            }
        );
    }

    @NonNull
    private BannerAdSize getBannerAdSize() {
        final DisplayMetrics displayMetrics = getResources().getDisplayMetrics();
        int adWidthPixels = bannerAdView != null ? bannerAdView.getWidth() : 0;
        if (adWidthPixels == 0) {
            adWidthPixels = displayMetrics.widthPixels;
        }
        final int adWidth = Math.round(adWidthPixels / displayMetrics.density);
        return BannerAdSize.sticky(this, adWidth);
    }

    private void loadBannerAd(@NonNull final BannerAdSize adSize) {
        if (bannerAdView == null) {
            return;
        }
        bannerAdView.setAdSize(adSize);
        bannerAdView.setBannerAdEventListener(new BannerAdEventListener() {
            @Override
            public void onAdLoaded() {
                if (isDestroyed() && bannerAdView != null) {
                    bannerAdView.destroy();
                }
            }

            @Override
            public void onAdFailedToLoad(@NonNull final AdRequestError adRequestError) {
                // Ad failed to load. Don't retry immediately; wait for the next
                // natural trigger (e.g. next app start) to avoid hammering the network.
            }

            @Override
            public void onAdClicked() {
            }

            @Override
            public void onImpression(@Nullable final ImpressionData impressionData) {
            }
        });
        bannerAdView.loadAd(new AdRequest.Builder(BANNER_AD_UNIT_ID).build());
    }

    // ---- App open ad (R-M-19526722-1) ----------------------------------------
    // https://ads.yandex.com/helpcenter/en/dev/android/app-open-ad

    private void setupAppOpenAd() {
        appOpenAdLoader = new AppOpenAdLoader(this);
        loadAppOpenAd();

        ProcessLifecycleOwner.get().getLifecycle().addObserver(new DefaultProcessLifecycleObserver() {
            @Override
            public void onProcessCameForeground() {
                if (isFirstForegroundEvent) {
                    // Skip the initial cold start so the ad never covers the splash screen.
                    isFirstForegroundEvent = false;
                    return;
                }
                showAppOpenAd();
            }
        });
    }

    private void loadAppOpenAd() {
        if (appOpenAdLoader == null) {
            return;
        }
        final AdRequest adRequest = new AdRequest.Builder(APP_OPEN_AD_UNIT_ID).build();
        appOpenAdLoader.loadAd(adRequest, new AppOpenAdLoadListener() {
            @Override
            public void onAdLoaded(@NonNull final AppOpenAd loadedAppOpenAd) {
                appOpenAd = loadedAppOpenAd;
            }

            @Override
            public void onAdFailedToLoad(@NonNull final AdRequestError adRequestError) {
                // Ad failed to load; we'll simply try again next time the app
                // comes back to the foreground (see onProcessCameForeground above).
            }
        });
    }

    private void showAppOpenAd() {
        if (appOpenAd == null) {
            return;
        }
        appOpenAd.setAdEventListener(new AppOpenAdEventListener() {
            @Override
            public void onAdShown() {
            }

            @Override
            public void onAdFailedToShow(@NonNull final AdError adError) {
            }

            @Override
            public void onAdDismissed() {
                clearAppOpenAd();
                loadAppOpenAd();
            }

            @Override
            public void onAdClicked() {
            }

            @Override
            public void onAdImpression(@Nullable final ImpressionData impressionData) {
            }
        });
        appOpenAd.show(this);
    }

    private void clearAppOpenAd() {
        if (appOpenAd != null) {
            appOpenAd.setAdEventListener(null);
            appOpenAd = null;
        }
    }

    private void requestAudioPermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.RECORD_AUDIO},
                PERMISSION_REQUEST_CODE
            );
        }
    }
}
