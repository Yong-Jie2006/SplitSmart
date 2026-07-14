# AI log

- The initial dashboard API exposed independently fetched top-level fields; it was changed to one snapshot-backed `dashboard` query.
- Balance calculations originally fetched people and expenses independently; they now use the same rows used for the expense list.
- The dashboard transaction uses repeatable-read isolation so concurrent writes cannot mix old and new data in one response.
- Amount validation currently lives in the UI and GraphQL layer; database `CHECK` constraints are still planned as a second line of defense.
- The settlement algorithm is exact but may need a group-size limit before the app supports larger groups.
