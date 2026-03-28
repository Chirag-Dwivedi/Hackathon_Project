import pymysql

db_host = 'expensetrackerdb.cha46q8mu6lt.us-east-2.rds.amazonaws.com'
db_user = 'admin'
db_password = 'Chirag#13'
db_name = 'expense_tracker'


def get_connection():
    connection = pymysql.connect(
        host=db_host,
        user=db_user,
        password=db_password,
        database=db_name
                )
    return connection


def create_tables():
    statements = [
        """
        CREATE TABLE IF NOT EXISTS users (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(255) UNIQUE,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS moodboards (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            user_id BIGINT NOT NULL,
            title VARCHAR(120) NOT NULL,
            description TEXT,
            aesthetic VARCHAR(80),
            season VARCHAR(40),
            occasion VARCHAR(80),
            cover_image_url TEXT,
            is_public BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_moodboards_user
                FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS moodboard_items (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            moodboard_id BIGINT NOT NULL,
            image_url TEXT NOT NULL,
            source_url TEXT,
            note TEXT,
            display_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_moodboard_items_moodboard
                FOREIGN KEY (moodboard_id) REFERENCES moodboards(id)
                ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS closet_items (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            user_id BIGINT NOT NULL,
            name VARCHAR(120) NOT NULL,
            category VARCHAR(80) NOT NULL,
            subcategory VARCHAR(80),
            color VARCHAR(40),
            brand VARCHAR(80),
            size VARCHAR(30),
            season VARCHAR(40),
            occasion VARCHAR(80),
            image_url TEXT,
            wear_count INT NOT NULL DEFAULT 0,
            last_worn_at DATETIME,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_closet_items_user
                FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS outfits (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            user_id BIGINT NOT NULL,
            name VARCHAR(120) NOT NULL,
            description TEXT,
            occasion VARCHAR(80),
            season VARCHAR(40),
            mood VARCHAR(40),
            cover_image_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_outfits_user
                FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS outfit_items (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            outfit_id BIGINT NOT NULL,
            closet_item_id BIGINT NOT NULL,
            item_role VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_outfit_items_outfit
                FOREIGN KEY (outfit_id) REFERENCES outfits(id)
                ON DELETE CASCADE,
            CONSTRAINT fk_outfit_items_closet_item
                FOREIGN KEY (closet_item_id) REFERENCES closet_items(id)
                ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS favorites (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            user_id BIGINT NOT NULL,
            favorite_type VARCHAR(40) NOT NULL,
            reference_id BIGINT,
            image_url TEXT,
            note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_favorites_user
                FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS style_preferences (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            user_id BIGINT NOT NULL UNIQUE,
            preferred_styles TEXT,
            preferred_colors TEXT,
            avoided_colors TEXT,
            favorite_brands TEXT,
            sizes TEXT,
            budget_level VARCHAR(40),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_style_preferences_user
                FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS occasion_history (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            user_id BIGINT NOT NULL,
            outfit_id BIGINT,
            occasion_name VARCHAR(120) NOT NULL,
            event_date DATE,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_occasion_history_user
                FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE,
            CONSTRAINT fk_occasion_history_outfit
                FOREIGN KEY (outfit_id) REFERENCES outfits(id)
                ON DELETE SET NULL
        )
        """
    ]

    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)
            cursor.execute("SHOW COLUMNS FROM users LIKE 'email'")
            if cursor.fetchone() is None:
                cursor.execute(
                    """
                    ALTER TABLE users
                    ADD COLUMN email VARCHAR(255) UNIQUE
                    AFTER username
                    """
                )
        connection.commit()
    finally:
        connection.close()


def list_tables():
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SHOW TABLES")
            return [row[0] for row in cursor.fetchall()]
    finally:
        connection.close()
