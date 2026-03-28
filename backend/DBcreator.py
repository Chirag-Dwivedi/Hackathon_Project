import pymysql

conn = pymysql.connect(
    host='expensetrackerdb.cha46q8mu6lt.us-east-2.rds.amazonaws.com',
    user='admin',
    password='Chirag#13'
)

cursor = conn.cursor()
cursor.execute("CREATE DATABASE expense_tracker;")
conn.commit()
cursor.close()
conn.close()

print("Database created!")