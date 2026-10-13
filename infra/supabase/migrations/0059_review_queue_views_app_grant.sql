-- 0045 granted the review_moderation tables the API uses but not the two queue views its review and
-- moderation repositories read, so staff review and appeal queues would be denied in production. The
-- app-role grants test (#571) now fails on any relation the API's schemas leave unreadable.
grant select on review_moderation.review_case_queue, review_moderation.appeal_queue to zhipanda_app;
