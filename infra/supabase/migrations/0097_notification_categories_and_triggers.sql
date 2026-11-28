-- Extend V2 notification categories to support panda birthdays and followed panda/venue news.
begin;

alter table notification.channel_preferences
  drop constraint channel_preferences_category_check,
  add constraint channel_preferences_category_check
    check (category in ('knowledge_update', 'correction', 'birthday_reminder', 'panda_news', 'venue_news'));

alter table notification.messages
  drop constraint messages_category_check,
  add constraint messages_category_check
    check (category in ('knowledge_update', 'correction', 'birthday_reminder', 'panda_news', 'venue_news'));

commit;
