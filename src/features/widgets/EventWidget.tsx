'use no memo';

import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { EventItem } from "@/types/models";
import { getElapsedTime } from "@/utils/elapsed";

export function EventWidget({ event, width, height }: { event: EventItem | null; width?: number; height?: number }) {
  const compact = (width ?? 0) < 190 || (height ?? 0) < 95;
  const label = event?.name ?? "Choose a moment";
  const elapsed = event ? getElapsedTime(event.lastOccurredAt) : "Open Little Again to set up";

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={event ? `${event.name}, ${elapsed}` : "Choose a moment for this widget"}
      style={{
        width: "match_parent",
        height: "match_parent",
        backgroundColor: "#193A35",
        borderRadius: 26,
        paddingHorizontal: compact ? 12 : 22,
        paddingVertical: compact ? 10 : 18,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {!compact && event ? <TextWidget text={event.icon} style={{ fontSize: 22, color: "#E7F0EC", marginBottom: 4 }} /> : null}
      <TextWidget text={label} truncate="END" maxLines={1} style={{ fontSize: compact ? 15 : 18, fontWeight: "500", color: "#F1F5F2", textAlign: "center" }} />
      <TextWidget text={event?.lastOccurredAt ? elapsed : event ? "No entries" : elapsed} truncate="END" maxLines={1} style={{ fontSize: compact ? 12 : 14, color: "#C4D3CE", textAlign: "center", marginTop: 5 }} />
      {!compact && event ? <TextWidget text={event.categoryName} truncate="END" maxLines={1} style={{ fontSize: 10, color: "#91AAA2", textAlign: "center", marginTop: 6 }} /> : null}
    </FlexWidget>
  );
}
