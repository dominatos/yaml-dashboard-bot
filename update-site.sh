cp /var/www/html/conf.yml /var/www/html/conf.yml-bak --backup=t
cp /home/sviatoslav/scripts/yaml-dashboard-bot/index.php /var/www/html/index.php --backup=t
cd /home/sviatoslav/scripts/yaml-dashboard-bot/tg-admin-bot/ && docker compose down && docker compose build --no-cache && docker compose up -d
cd /home/sviatoslav/scripts/dashy && docker compose down && docker compose up -d



