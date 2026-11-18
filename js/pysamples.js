const PY_SAMPLES = [
  ["Total and average", "1, 2, 3, 4, 5", `# Total and average of five numbers
total = 0
for i in range(5):
    number = int(input("Enter a number: "))
    total = total + number
print("Total:", total)
print("Average:", total / 5)`],
  ["if / elif / else", "64", `score = int(input("Score: "))
if score >= 70:
    print("Grade A")
elif score >= 50:
    print("Grade B")
else:
    print("Grade C")`],
  ["while True and break", "abc, secret99, x", `password = ""
attempts = 0
while True:
    password = input("Enter password: ")
    attempts += 1
    if password == "secret99" or attempts == 3:
        break
print("Attempts used:", attempts)`],
  ["Functions", "", `def area(width, height):
    return width * height

def greet(name):
    print(f"Hello, {name}!")

greet("Sam")
print("Area:", area(4, 5))`],
  ["Lists and bubble sort", "", `data = [42, 7, 19, 88, 3]
swapped = True
while swapped:
    swapped = False
    for i in range(len(data) - 1):
        if data[i] > data[i + 1]:
            data[i], data[i + 1] = data[i + 1], data[i]
            swapped = True
for item in data:
    print(item)`],
  ["Counting vowels", "Pseudocode Lab", `text = input("Word: ")
vowels = 0
for ch in text.lower():
    if ch in "aeiou":
        vowels += 1
print("Vowels:", vowels)`],
  ["Fibonacci with tuple assignment", "", `a, b = 0, 1
for _ in range(10):
    print(a)
    a, b = b, a + b`],
];
