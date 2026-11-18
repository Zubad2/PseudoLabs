const seq = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join(", ");
const SAMPLE = [42, 7, 19, 88, 3, 56, 21, 64, 11, 30, 95, 2, 77, 14, 60];
const sample = (n) => SAMPLE.slice(0, n).join(", ");
const declare = (n) => `DECLARE Data : ARRAY[1:${n}] OF INTEGER`;
const readAll = (n) => `FOR Counter ← 1 TO ${n}
   INPUT Data[Counter]
NEXT Counter`;
const showAll = (n) => `FOR Counter ← 1 TO ${n}
   OUTPUT Data[Counter]
NEXT Counter`;

const algos = [
  {
    id: "total",
    name: "Totalling and average",
    desc: "Reads N numbers, keeps a running total, then outputs the total and the average.",
    params: [{ k: "n", l: "How many numbers", v: 5 }],
    inputs: (p) => seq(p.n, (i) => (i + 1) * 10),
    code: (p) => `DECLARE Total, Number : REAL
DECLARE Counter : INTEGER
Total ← 0
FOR Counter ← 1 TO ${p.n}
   INPUT Number
   Total ← Total + Number
NEXT Counter
OUTPUT "Total: ", Total
OUTPUT "Average: ", ROUND(Total / ${p.n}, 2)`,
  },
  {
    id: "extremes",
    name: "Largest and smallest",
    desc: "Reads N numbers and keeps the largest and the smallest seen so far.",
    params: [{ k: "n", l: "How many numbers", v: 6 }],
    inputs: (p) => sample(p.n),
    code: (p) => `DECLARE Number, Largest, Smallest : INTEGER
DECLARE Counter : INTEGER
INPUT Number
Largest ← Number
Smallest ← Number
FOR Counter ← 2 TO ${p.n}
   INPUT Number
   IF Number > Largest
      THEN
         Largest ← Number
   ENDIF
   IF Number < Smallest
      THEN
         Smallest ← Number
   ENDIF
NEXT Counter
OUTPUT "Largest: ", Largest
OUTPUT "Smallest: ", Smallest`,
  },
  {
    id: "threshold",
    name: "Count values above a limit",
    desc: "Counts how many of N numbers are greater than a limit you choose.",
    params: [
      { k: "n", l: "How many numbers", v: 8 },
      { k: "limit", l: "Limit", v: 40 },
    ],
    inputs: (p) => sample(p.n),
    code: (p) => `DECLARE Number, Above, Counter : INTEGER
Above ← 0
FOR Counter ← 1 TO ${p.n}
   INPUT Number
   IF Number > ${p.limit}
      THEN
         Above ← Above + 1
   ENDIF
NEXT Counter
OUTPUT Above, " of ${p.n} values are above ${p.limit}"`,
  },
  {
    id: "linear",
    name: "Linear search",
    desc: "Fills an array, then checks each item in turn until the target is found.",
    params: [{ k: "n", l: "Array size", v: 6 }],
    inputs: (p) => sample(p.n) + ", " + SAMPLE[Math.min(2, p.n - 1)],
    code: (p) => `${declare(p.n)}
DECLARE Target, Position, Counter : INTEGER
DECLARE Found : BOOLEAN
${readAll(p.n)}
INPUT Target
Found ← FALSE
Counter ← 1
WHILE Counter <= ${p.n} AND Found = FALSE DO
   IF Data[Counter] = Target
      THEN
         Found ← TRUE
         Position ← Counter
   ENDIF
   Counter ← Counter + 1
ENDWHILE
IF Found
   THEN OUTPUT "Found at position ", Position
   ELSE OUTPUT "Not found"
ENDIF`,
  },
  {
    id: "binary",
    name: "Binary search",
    desc: "Halves the search range each step. The data must already be in ascending order.",
    params: [{ k: "n", l: "Array size", v: 8 }],
    inputs: (p) => seq(p.n, (i) => (i + 1) * 5) + ", " + 5 * Math.ceil(p.n / 2),
    code: (p) => `${declare(p.n)}
DECLARE Target, Low, High, Mid, Counter : INTEGER
DECLARE Found : BOOLEAN
${readAll(p.n)}
INPUT Target
Low ← 1
High ← ${p.n}
Found ← FALSE
WHILE Low <= High AND Found = FALSE DO
   Mid ← (Low + High) DIV 2
   IF Data[Mid] = Target
      THEN Found ← TRUE
      ELSEIF Data[Mid] < Target
         THEN Low ← Mid + 1
         ELSE High ← Mid - 1
   ENDIF
ENDWHILE
IF Found
   THEN OUTPUT "Found at position ", Mid
   ELSE OUTPUT "Not found"
ENDIF`,
  },
  {
    id: "bubble",
    name: "Bubble sort",
    desc: "Repeatedly swaps neighbours that are out of order until a pass makes no swaps.",
    params: [{ k: "n", l: "Array size", v: 6 }],
    inputs: (p) => sample(p.n),
    code: (p) => `${declare(p.n)}
DECLARE Counter, Temp : INTEGER
DECLARE Swapped : BOOLEAN
${readAll(p.n)}
REPEAT
   Swapped ← FALSE
   FOR Counter ← 1 TO ${p.n} - 1
      IF Data[Counter] > Data[Counter + 1]
         THEN
            Temp ← Data[Counter]
            Data[Counter] ← Data[Counter + 1]
            Data[Counter + 1] ← Temp
            Swapped ← TRUE
      ENDIF
   NEXT Counter
UNTIL Swapped = FALSE
${showAll(p.n)}`,
  },
  {
    id: "selection",
    name: "Selection sort",
    desc: "Finds the smallest remaining item and moves it to the front, one position at a time.",
    params: [{ k: "n", l: "Array size", v: 6 }],
    inputs: (p) => sample(p.n),
    code: (p) => `${declare(p.n)}
DECLARE Counter, Outer, Inner, Smallest, Temp : INTEGER
${readAll(p.n)}
FOR Outer ← 1 TO ${p.n} - 1
   Smallest ← Outer
   FOR Inner ← Outer + 1 TO ${p.n}
      IF Data[Inner] < Data[Smallest]
         THEN
            Smallest ← Inner
      ENDIF
   NEXT Inner
   Temp ← Data[Outer]
   Data[Outer] ← Data[Smallest]
   Data[Smallest] ← Temp
NEXT Outer
${showAll(p.n)}`,
  },
  {
    id: "insertion",
    name: "Insertion sort",
    desc: "Takes each item in turn and slides it left into its correct place.",
    params: [{ k: "n", l: "Array size", v: 6 }],
    inputs: (p) => sample(p.n),
    code: (p) => `${declare(p.n)}
DECLARE Counter, Outer, Inner, Key : INTEGER
${readAll(p.n)}
FOR Outer ← 2 TO ${p.n}
   Key ← Data[Outer]
   Inner ← Outer - 1
   WHILE Inner >= 1 AND Data[Inner] > Key DO
      Data[Inner + 1] ← Data[Inner]
      Inner ← Inner - 1
   ENDWHILE
   Data[Inner + 1] ← Key
NEXT Outer
${showAll(p.n)}`,
  },
  {
    id: "range",
    name: "Range check with repeat",
    desc: "Keeps asking until the value is inside the allowed range.",
    params: [
      { k: "lo", l: "Lowest allowed", v: 1 },
      { k: "hi", l: "Highest allowed", v: 10 },
    ],
    inputs: (p) => `${p.hi + 5}, ${p.lo - 1}, ${p.lo}`,
    code: (p) => `DECLARE Value : INTEGER
REPEAT
   OUTPUT "Enter a number from ${p.lo} to ${p.hi}"
   INPUT Value
   IF Value < ${p.lo} OR Value > ${p.hi}
      THEN
         OUTPUT "Invalid, try again"
   ENDIF
UNTIL Value >= ${p.lo} AND Value <= ${p.hi}
OUTPUT "Accepted: ", Value`,
  },
  {
    id: "password",
    name: "Password with double entry",
    desc: "Length check plus a second entry that must match, with three attempts.",
    params: [{ k: "min", l: "Minimum length", v: 8 }],
    inputs: () => "abc, secret99, secret99",
    code: (p) => `DECLARE Password, Confirm : STRING
DECLARE Attempt : INTEGER
DECLARE Matched : BOOLEAN
Attempt ← 0
Matched ← FALSE
REPEAT
   OUTPUT "Enter password"
   INPUT Password
   IF LENGTH(Password) >= ${p.min}
      THEN
         OUTPUT "Re-enter password"
         INPUT Confirm
         IF Password = Confirm
            THEN
               Matched ← TRUE
         ENDIF
      ELSE
         OUTPUT "Too short"
   ENDIF
   Attempt ← Attempt + 1
UNTIL Matched OR Attempt = 3
IF Matched
   THEN OUTPUT "Password success"
   ELSE OUTPUT "Password fail"
ENDIF`,
  },
  {
    id: "factorial",
    name: "Factorial",
    desc: "Multiplies the numbers from 2 up to N.",
    params: [{ k: "n", l: "N", v: 6 }],
    inputs: () => "",
    code: (p) => `DECLARE Answer, Counter : INTEGER
Answer ← 1
FOR Counter ← 2 TO ${p.n}
   Answer ← Answer * Counter
NEXT Counter
OUTPUT "${p.n}! = ", Answer`,
  },
  {
    id: "prime",
    name: "Prime number test",
    desc: "Tries each divisor up to the square root of the number.",
    params: [{ k: "n", l: "Number to test", v: 97 }],
    inputs: () => "",
    code: (p) => `DECLARE Number, Divisor : INTEGER
DECLARE IsPrime : BOOLEAN
Number ← ${p.n}
IsPrime ← Number > 1
Divisor ← 2
WHILE IsPrime AND Divisor * Divisor <= Number DO
   IF Number MOD Divisor = 0
      THEN
         IsPrime ← FALSE
   ENDIF
   Divisor ← Divisor + 1
ENDWHILE
IF IsPrime
   THEN OUTPUT Number, " is prime"
   ELSE OUTPUT Number, " is not prime"
ENDIF`,
  },
  {
    id: "fibonacci",
    name: "Fibonacci sequence",
    desc: "Each term is the sum of the two before it.",
    params: [{ k: "n", l: "How many terms", v: 10 }],
    inputs: () => "",
    code: (p) => `DECLARE First, Second, Third, Counter : INTEGER
First ← 0
Second ← 1
OUTPUT First
OUTPUT Second
FOR Counter ← 3 TO ${p.n}
   Third ← First + Second
   OUTPUT Third
   First ← Second
   Second ← Third
NEXT Counter`,
  },
  {
    id: "gcd",
    name: "Greatest common divisor",
    desc: "Euclid’s algorithm: replace the pair with the second number and the remainder until the remainder is zero.",
    params: [
      { k: "a", l: "First number", v: 84 },
      { k: "b", l: "Second number", v: 36 },
    ],
    inputs: () => "",
    code: (p) => `DECLARE A, B, Remainder : INTEGER
A ← ${p.a}
B ← ${p.b}
WHILE B <> 0 DO
   Remainder ← A MOD B
   A ← B
   B ← Remainder
ENDWHILE
OUTPUT "GCD is ", A`,
  },
  {
    id: "menu",
    name: "Menu with CASE",
    desc: "Shows a menu until the user chooses to quit.",
    params: [],
    inputs: () => "1, 2, 7, 3",
    code: () => `DECLARE Choice : INTEGER
REPEAT
   OUTPUT "1 Add   2 Multiply   3 Quit"
   INPUT Choice
   CASE OF Choice
      1 : OUTPUT "Adding"
      2 : OUTPUT "Multiplying"
      3 : OUTPUT "Goodbye"
      OTHERWISE OUTPUT "Invalid choice"
   ENDCASE
UNTIL Choice = 3`,
  },
  {
    id: "bars",
    name: "Bar chart (graphics)",
    desc: "Reads N heights and draws one bar for each on the Graphics canvas.",
    params: [{ k: "n", l: "Number of bars", v: 8 }],
    inputs: (p) => sample(p.n),
    code: (p) => `CANVAS(${40 * p.n + 60}, 320)
BACKGROUND("#fffdf5")
DECLARE Counter, Height : INTEGER
FOR Counter ← 1 TO ${p.n}
   INPUT Height
   IF Height > 60
      THEN COLOUR("#1d6f6a")
      ELSE COLOUR("#d95f02")
   ENDIF
   FILLRECT(40 * Counter, 300 - Height * 2.5, 28, Height * 2.5)
NEXT Counter
COLOUR("#1b2a49")
LINE(20, 300, ${40 * p.n + 50}, 300)`,
  },
];

algos.push(
  {
    id: "reverse",
    name: "Reverse a string",
    desc: "Builds a new string by reading the characters from the last to the first.",
    params: [],
    inputs: () => "stressed",
    code: () => `DECLARE Text, Reversed : STRING
DECLARE Counter : INTEGER
INPUT Text
Reversed ← ""
FOR Counter ← LENGTH(Text) TO 1 STEP -1
   Reversed ← Reversed & MID(Text, Counter, 1)
NEXT Counter
OUTPUT Reversed`,
  },
  {
    id: "palindrome",
    name: "Palindrome check",
    desc: "Compares a word with its reverse, ignoring upper and lower case.",
    params: [],
    inputs: () => "Level",
    code: () => `DECLARE Text, Cleaned, Reversed : STRING
DECLARE Counter : INTEGER
INPUT Text
Cleaned ← UCASE(Text)
Reversed ← ""
FOR Counter ← LENGTH(Cleaned) TO 1 STEP -1
   Reversed ← Reversed & MID(Cleaned, Counter, 1)
NEXT Counter
IF Cleaned = Reversed
   THEN OUTPUT Text, " is a palindrome"
   ELSE OUTPUT Text, " is not a palindrome"
ENDIF`,
  },
  {
    id: "vowels",
    name: "Count vowels",
    desc: "Looks at each character in turn and counts the vowels.",
    params: [],
    inputs: () => "Pseudocode Lab",
    code: () => `DECLARE Text, Letter : STRING
DECLARE Counter, Vowels : INTEGER
INPUT Text
Vowels ← 0
FOR Counter ← 1 TO LENGTH(Text)
   Letter ← UCASE(MID(Text, Counter, 1))
   IF CONTAINS("AEIOU", Letter)
      THEN
         Vowels ← Vowels + 1
   ENDIF
NEXT Counter
OUTPUT "Vowels: ", Vowels`,
  },
  {
    id: "caesar",
    name: "Caesar cipher",
    desc: "Shifts every capital letter along the alphabet by a fixed amount.",
    params: [{ k: "shift", l: "Shift", v: 3 }],
    inputs: () => "HELLO WORLD",
    code: (p) => `DECLARE Text, Result, Letter : STRING
DECLARE Counter, Code : INTEGER
INPUT Text
Result ← ""
FOR Counter ← 1 TO LENGTH(Text)
   Letter ← MID(Text, Counter, 1)
   IF Letter >= "A" AND Letter <= "Z"
      THEN
         Code ← (ASC(Letter) - 65 + ${p.shift}) MOD 26 + 65
         Result ← Result & CHR(Code)
      ELSE
         Result ← Result & Letter
   ENDIF
NEXT Counter
OUTPUT Result`,
  },
  {
    id: "grid",
    name: "Times table grid (2D array)",
    desc: "Fills a two-dimensional array and prints it row by row.",
    params: [{ k: "n", l: "Grid size", v: 5 }],
    inputs: () => "",
    code: (p) => `DECLARE Grid : ARRAY[1:${p.n},1:${p.n}] OF INTEGER
DECLARE Row, Col : INTEGER
DECLARE Line : STRING
FOR Row ← 1 TO ${p.n}
   Line ← ""
   FOR Col ← 1 TO ${p.n}
      Grid[Row, Col] ← Row * Col
      Line ← Line & Grid[Row, Col] & " "
   NEXT Col
   OUTPUT Line
NEXT Row`,
  },
);
