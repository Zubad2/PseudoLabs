const DOC = [
  [
    "Basics",
    "Keywords are written in CAPITALS. Comments start with //. Assignment uses ← (press the ← button, or type <-). Leading line numbers such as 01 are ignored, so exam code can be pasted as it is.",
    `// a comment
Count ← 0
Name ← "Asha"
Passed ← TRUE`,
  ],
  [
    "Data types and DECLARE",
    "INTEGER (whole numbers), REAL (decimals), STRING (text in double quotes), CHAR (one character, single quotes), BOOLEAN (TRUE or FALSE). A declared type is checked: storing text in a REAL is an error. CONSTANT values cannot change.",
    `DECLARE Total : REAL
DECLARE Name, Town : STRING
CONSTANT Pi ← 3.14`,
  ],
  [
    "Arrays",
    "Give the lower and upper index. Indexes outside the bounds cause an error. Two dimensions are separated by a comma.",
    `DECLARE Marks : ARRAY[1:30] OF INTEGER
Marks[1] ← 75
DECLARE Grid : ARRAY[1:3,1:4] OF INTEGER
Grid[2,3] ← 9`,
  ],
  [
    "Input and output",
    "INPUT reads one value for each name. OUTPUT (or PRINT) shows its items one after another with nothing added between them, so include spaces in your text.",
    `INPUT Name
INPUT A, B
OUTPUT "Total is ", Total`,
  ],
  [
    "Operators",
    "Arithmetic: + - * / ^ (power). DIV is whole-number division (9 DIV 4 = 2). MOD is the remainder (9 MOD 4 = 1). Comparison: = <> < > <= >=. Logic: AND OR NOT. Join text with &.",
    `Avg ← Total / 5
Tens ← Number DIV 10
Last ← Number MOD 10
Full ← First & " " & Last
IF Age >= 12 AND Age <= 18 THEN ...`,
  ],
  [
    "Selection: IF",
    "Every IF needs THEN and its own ENDIF. ELSE is optional. A nested IF is closed by its own ENDIF.",
    `IF Score >= 50
   THEN
      OUTPUT "Pass"
   ELSE
      OUTPUT "Fail"
ENDIF`,
  ],
  [
    "Selection: CASE",
    "Each value is followed by a colon and one statement. OTHERWISE catches everything else. A range uses TO.",
    `CASE OF Grade
   'A' : OUTPUT "Excellent"
   'B' : OUTPUT "Good"
   OTHERWISE OUTPUT "Keep trying"
ENDCASE`,
  ],
  [
    "Iteration: FOR",
    "Count-controlled. The counter goes up by 1 unless STEP is given. End with NEXT.",
    `FOR Counter ← 1 TO 10
   OUTPUT Counter
NEXT Counter
FOR N ← 10 TO 1 STEP -1`,
  ],
  [
    "Iteration: WHILE",
    "Condition-controlled, checked before each pass, so the body may run zero times.",
    `WHILE Number <> -1 DO
   INPUT Number
ENDWHILE`,
  ],
  [
    "Iteration: REPEAT",
    "Condition-controlled, checked after each pass, so the body runs at least once. It stops when the condition becomes TRUE.",
    `REPEAT
   INPUT Password
UNTIL Length(Password) >= 8`,
  ],
  [
    "Procedures and functions",
    "A procedure is run with CALL. A function RETURNS a value and is used inside an expression. Parameters are passed by value (BYREF and BYVAL are accepted but both behave as by value).",
    `PROCEDURE Greet(Name : STRING)
   OUTPUT "Hello ", Name
ENDPROCEDURE
FUNCTION Double(X : INTEGER) RETURNS INTEGER
   RETURN X * 2
ENDFUNCTION
CALL Greet("Sam")
OUTPUT Double(4)`,
  ],
  [
    "Built-in functions",
    "LENGTH(s) or LEN(s), LEFT(s, n), RIGHT(s, n), MID(s, start, n) with the first character at position 1, UCASE(s), LCASE(s), ROUND(x, places), RANDOM() between 0 and 1, INT(x) drops the decimals.",
    `OUTPUT ROUND(3.14159, 2)
OUTPUT MID("COMPUTER", 4, 3)
Pick ← INT(RANDOM() * 6) + 1`,
  ],
  [
    "Using this tool",
    "Auto-inputs feeds INPUT automatically, which is ideal for the exam data in trace table questions. Otherwise a box appears under the console. The Trace table tab records every assignment, input and output as one row. Errors name the line and say what went wrong. Stop ends a runaway loop.",
    "",
  ],
];

DOC.push(
  [
    "Higher-level shortcuts",
    "These go beyond the exam syllabus but make experiments quicker. x += 1 (also -=, *=, /=) updates a variable in place. SWAP exchanges two variables or array items. ELSEIF adds more conditions to one IF with a single ENDIF. FOREACH visits every item of an array in index order.",
    `Total += Mark
SWAP Data[1], Data[2]
IF Mark >= 70
   THEN Grade ← "A"
   ELSEIF Mark >= 50
      THEN Grade ← "B"
   ELSE Grade ← "C"
ENDIF
FOREACH Item IN Data
   OUTPUT Item
NEXT Item`,
  ],
  [
    "Array and number helpers",
    "SIZE(array), SUM(array), MAX(array) or MAX(a, b), MIN likewise, SORT(array) sorts in place from smallest to largest, ABS(x), SQRT(x), CONTAINS(text, part), INDEXOF(text, part) which gives 0 when the part is missing.",
    `SORT(Data)
OUTPUT "Largest: ", MAX(Data)`,
  ],
  [
    "Graphics",
    'The Graphics tab shows a canvas that your program draws on. CANVAS(width, height) starts a new one (at most 1200 by 900). COLOUR("teal") sets the colour for the commands that follow; names and hex codes both work. LINE(x1, y1, x2, y2), RECT and FILLRECT(x, y, width, height), CIRCLE and FILLCIRCLE(x, y, radius), TEXT(x, y, "words"), BACKGROUND(colour). Point (0, 0) is the top-left corner. Use Download PNG to keep the picture.',
    `CANVAS(300, 200)
COLOUR("teal")
FILLCIRCLE(150, 100, 60)
COLOUR("black")
TEXT(120, 92, "Hello")`,
  ],
  [
    "Flowchart generator",
    "The Flowchart tab turns the program in the editor into a flowchart image with terminals, input and output shapes, process boxes, decisions with Yes and No branches and loops with return arrows. Procedure and function bodies are not drawn. Download it as a PNG.",
    "",
  ],
  [
    "Algorithm generator",
    "The Generator tab writes ready-made programs for common exam algorithms: totalling, searching, sorting, validation, passwords, number sequences and more. Change the settings, then insert the code into the editor, or insert and run it straight away with sample inputs filled in.",
    "",
  ],
);

DOC.push(
  [
    "More helpers",
    "Maths: SIN(x), COS(x) (radians), PI(), FLOOR(x), CEIL(x), RANDOMINT(low, high). Text codes: ASC(character) gives the character code, CHR(number) turns a code back into a character. Graphics extras: WIDTH(pixels) sets the line thickness, PIXEL(x, y), TRIANGLE and FILLTRIANGLE(x1, y1, x2, y2, x3, y3).",
    `Letter ← CHR(ASC("A") + 2)
Roll ← RANDOMINT(1, 6)
TRIANGLE(10, 90, 50, 10, 90, 90)`,
  ],
  [
    "Debugging tools",
    "Pick a speed beside the Run button. Animate runs highlight the line being executed. Step by step pauses on every line: press Next (or F10) to continue. The Variables tab shows the current value of every global variable and array. When an error stops the program, its line is marked in red. The Debug me examples contain the faults from past paper questions, so run them and fix what the error message points to.",
    "",
  ],
  [
    "Files and shortcuts",
    "New, Open and Save work with plain text .psc files. Your program is also kept in this browser automatically. Ctrl+Enter runs the program, Tab inserts three spaces, and Enter keeps the indentation of the previous line, adding three more after IF, FOR, WHILE, REPEAT and similar lines.",
    "",
  ],
);

DOC.push(
  [
    "Coming from Python?",
    "Pseudocode does the same jobs with different spelling. = to assign becomes ←, == becomes =, != becomes <>, and/or/not become AND OR NOT, // becomes DIV, % becomes MOD, ** becomes ^. There are no colons or braces: blocks end with ENDIF, ENDWHILE, NEXT, UNTIL, ENDPROCEDURE or ENDFUNCTION. print() is OUTPUT and input() is INPUT. range(1, 11) stops before 11, but FOR … TO 10 includes 10. Python lists start at index 0, exam arrays usually at 1. Try the Convert tab to see any Python program translated line by line.",
    `Python                    Pseudocode
x = 5                     X ← 5
if x == 5:                IF X = 5
                             THEN
for i in range(1, 11):    FOR I ← 1 TO 10
while x < 3:              WHILE X < 3 DO
print("a", x)             OUTPUT "a ", X
n = int(input())          INPUT N
def f(a): return a * 2    FUNCTION F(A : INTEGER) RETURNS INTEGER`,
  ],
  [
    "Convert tab",
    "Convert Python to pseudocode, or pseudocode to Python. Convert shows the result at once. Animate highlights each source line, types the matching lines, and explains the rule used. Choose Step by step and press Next for each line, or Pause and Finish. Exam syntax only avoids ELSEIF, += , SWAP and FOREACH. Things that cannot be translated (such as break, list.append or list comprehensions) are kept as comments and listed underneath. Python prints 30.0 where PseudoLab prints 30, and input() prompts stay on one line while OUTPUT ends the line.",
    "",
  ],
  [
    "Syntax checking",
    "The editor checks your program a moment after you stop typing. Mistakes are shown in the status bar and the line is tinted. Wavy red underlines mark Python habits such as ==, != or # comments. Messages say what to write instead, for example that == should be =, or that a block was never closed. Curly quotes and symbols pasted from exam papers (“ ” − × ÷ ≤ ≥) are understood.",
    "",
  ],
);
