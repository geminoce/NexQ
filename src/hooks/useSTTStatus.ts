import { useEffect, useRef } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { onSTTConnectionStatus, type STTConnectionStatusEvent } from "../lib/events";
import { showToast } from "../stores/toastStore";
import { t } from "../i18n";

function formatPartyLabel(party: string): string {
  if (party === "You") return t("overlay.transcript.you");
  if (party === "Them") return t("overlay.transcript.them");
  if (party === "Room") return t("overlay.transcript.room");
  return party;
}

export function useSTTStatus() {
  const connectedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let mounted = true;

    const setup = async () => {
      const u = await onSTTConnectionStatus((event: STTConnectionStatusEvent) => {
        if (!mounted) return;
        console.log("[STT Status]", event);

        if (event.status === "error" && event.message) {
          showToast(t("overlay.toasts.sttError", {
            party: formatPartyLabel(event.party),
            message: event.message,
          }), "error");
        } else if (event.status === "connected") {
          const key = `${event.provider}_${event.party}`;
          if (!connectedRef.current.has(key)) {
            connectedRef.current.add(key);
            showToast(t("overlay.toasts.sttConnected", {
              provider: event.provider,
              party: formatPartyLabel(event.party),
            }), "info");
          }
        } else if (event.status === "disconnected") {
          const key = `${event.provider}_${event.party}`;
          connectedRef.current.delete(key);
        }
      });
      if (mounted) unlisten = u; else u();
    };

    setup();
    return () => { mounted = false; if (unlisten) unlisten(); };
  }, []);
}
