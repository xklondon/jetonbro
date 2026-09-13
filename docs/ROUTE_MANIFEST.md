# Route manifest

Single registry for every REST route, socket event, and app-defined action type. Before adding any of the three, grep this table for an existing equivalent — extend it, do not duplicate it.

Identity is unique across the table. Use `GET /path` or `POST /path` for REST, the event name for sockets, and the action type string for app-defined actions.

| Kind | Identity | Owner module | Notes |
| --- | --- | --- | --- |
