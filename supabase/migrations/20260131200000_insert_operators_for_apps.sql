-- Insert operator entries so Job Hunter and Client Hub show on the /apps page
INSERT INTO suite_operators (user_app_id, user_id, name, description, status)
VALUES
    ('11262151-cf35-4105-a886-4422dd7879b8', '71963d89-452d-4ed3-ba16-e340f36a310f', 'Job Hunter', 'Job hunting command center with job boards, AI resume generator, pipeline tracker, and pre-apply checklist', 'active'),
    ('b1def9c6-bf5a-4b4a-ab1f-536c9f37c894', '71963d89-452d-4ed3-ba16-e340f36a310f', 'Client Hub', 'Client management dashboard with revenue tracking, request logs, outreach templates, and pitch scripts', 'active')
ON CONFLICT DO NOTHING;
